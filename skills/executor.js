/**
 * Skill Executor
 * 执行 Skill 中定义的动作序列，支持重试和错误分类
 */

const EventEmitter = require('events');

// 默认可重试的错误码/关键字
const DEFAULT_RETRYABLE_ERRORS = [
  'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
  'ESOCKETTIMEDOUT', 'timeout', 'EPIPE', 'EAI_AGAIN',
];

class SkillExecutor extends EventEmitter {
  constructor(actionExecutor, options = {}) {
    super();
    this.actionExecutor = actionExecutor;
    this.executionHistory = [];
    this.maxHistorySize = options.maxHistorySize ?? 100;

    this.retry = {
      maxRetries: options.maxRetries ?? 2,
      backoffMs: options.backoffMs ?? 1000,
      retryableErrors: options.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
    };
  }

  /**
   * 执行单个 Skill
   */
  async executeSkill(skill, params = {}, options = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    const execution = {
      id: executionId,
      skill: skill.name,
      params,
      startTime,
      endTime: null,
      status: 'running',
      results: [],
      error: null,
    };

    this.executionHistory.push(execution);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
    this.emit('execution:start', execution);

    try {
      const missingParams = this.validateParameters(skill, params);
      if (missingParams.length > 0) {
        throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
      }

      for (let i = 0; i < skill.actions.length; i++) {
        const action = skill.actions[i];
        const stepNumber = i + 1;

        this.emit('step:start', { executionId, stepNumber, action });

        try {
          const resolvedParams = this.resolveParameters(action.params, params, execution.results);
          const result = await this.executeActionWithRetry(action.action, resolvedParams, options);

          execution.results.push({
            step: stepNumber,
            action: action.action,
            params: resolvedParams,
            result,
            success: true,
            timestamp: Date.now(),
          });

          this.emit('step:complete', { executionId, stepNumber, result });

          if (options.stopOnError && !result.success) {
            throw new Error(`Step ${stepNumber} failed: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          execution.results.push({
            step: stepNumber,
            action: action.action,
            params: action.params,
            result: null,
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });

          this.emit('step:error', { executionId, stepNumber, error });

          if (options.stopOnError !== false) {
            throw error;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = Date.now();
      this.emit('execution:complete', execution);

      return {
        success: true,
        executionId,
        skill: skill.name,
        results: execution.results,
        duration: execution.endTime - execution.startTime,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      this.emit('execution:error', { execution, error });

      return {
        success: false,
        executionId,
        skill: skill.name,
        error: error.message,
        results: execution.results,
        duration: execution.endTime - execution.startTime,
      };
    }
  }

  /**
   * 带重试的 action 执行
   */
  async executeActionWithRetry(actionName, params, options, depth = 0) {
    try {
      const result = await this.executeAction(actionName, params, options);

      // 如果 result.success === false 且是可重试的错误，也触发重试
      if (result && result.success === false && this.isRetryableError(result.error)) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      if (depth >= this.retry.maxRetries || !this.isRetryableError(error.message)) {
        throw error;
      }

      const delay = this.retry.backoffMs * Math.pow(2, depth);
      this.emit('action:retry', { actionName, attempt: depth + 1, delay });

      await new Promise(r => setTimeout(r, delay));
      return this.executeActionWithRetry(actionName, params, options, depth + 1);
    }
  }

  /**
   * 判断错误是否可重试
   */
  isRetryableError(errorMessage) {
    if (!errorMessage) return false;
    const msg = String(errorMessage);
    return this.retry.retryableErrors.some(e => msg.includes(e));
  }

  /**
   * 验证必需参数
   */
  validateParameters(skill, params) {
    const missing = [];
    for (const param of skill.parameters || []) {
      if (param.required && !(param.name in params)) {
        missing.push(param.name);
      }
    }
    return missing;
  }

  /**
   * 解析参数占位符
   */
  resolveParameters(actionParams, userParams, previousResults) {
    const resolved = {};

    for (const [key, value] of Object.entries(actionParams)) {
      if (typeof value === 'string') {
        let resolvedValue = value.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
          return userParams[paramName] !== undefined ? userParams[paramName] : match;
        });

        resolvedValue = resolvedValue.replace(/\{\{step(\d+)\.(.+?)\}\}/g, (match, stepNum, path) => {
          const stepIndex = parseInt(stepNum) - 1;
          if (stepIndex >= 0 && stepIndex < previousResults.length) {
            const stepResult = previousResults[stepIndex];
            const pathParts = path.split('.');
            let val = stepResult;

            for (const part of pathParts) {
              if (val && typeof val === 'object' && part in val) {
                val = val[part];
              } else {
                return match;
              }
            }
            return val;
          }
          return match;
        });

        resolved[key] = resolvedValue;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 执行单个动作
   */
  async executeAction(actionName, params, options) {
    if (!this.actionExecutor) {
      throw new Error('Action executor not configured');
    }
    return await this.actionExecutor(actionName, params, options);
  }

  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  getExecution(executionId) {
    return this.executionHistory.find(e => e.id === executionId) || null;
  }

  clearHistory() {
    this.executionHistory = [];
  }
}

module.exports = SkillExecutor;
