/**
 * Skills System Adapter
 * 适配新的 SkillManager 到旧的 SkillSystem 接口
 */

const SkillManager = require('./manager');

class SkillSystemAdapter {
  constructor(openClawClient = null) {
    // 保存 OpenClaw 客户端引用
    this.openClawClient = openClawClient;

    // 创建动作执行器
    this.actionExecutor = this.createActionExecutor();

    // 创建新的 Skill Manager
    this.manager = new SkillManager(this.actionExecutor);

    // 加载所有 Skills
    this._ready = this.init();
  }

  get ready() {
    return this._ready;
  }

  /**
   * 初始化
   */
  async init() {
    try {
      await this.manager.loadAll();
      console.log('[Skills] Initialized with new manager');
    } catch (error) {
      console.error('[Skills] Failed to initialize:', error.message);
    }
  }

  /**
   * 设置 OpenClaw 客户端引用
   */
  setOpenClawClient(client) {
    this.openClawClient = client;
  }

  /**
   * 创建动作执行器
   * 这个执行器会将 Skill 的动作转发给 OpenClaw 的实际执行模块
   */
  createActionExecutor() {
    return async (actionName, params, options) => {
      if (!this.openClawClient) {
        console.warn('[Skills] OpenClaw client not set, returning placeholder');
        return {
          success: true,
          action: actionName,
          params: params,
          needsExecution: true,
        };
      }

      try {
        // 直接调用 OpenClaw 的 executeAction 方法
        const result = await this.openClawClient.executeAction(actionName, params);

        return {
          success: result.success !== false,
          result: result.result || result,
        };
      } catch (error) {
        console.error(`[Skills] Action execution failed: ${actionName}`, error.message);
        return {
          success: false,
          error: error.message,
        };
      }
    };
  }

  /**
   * 获取技能（兼容旧接口）
   */
  async getSkill(skillId) {
    const skill = this.manager.getSkill(skillId);

    if (!skill) {
      return {
        success: false,
        error: `技能不存在: ${skillId}`,
      };
    }

    return {
      success: true,
      skill: skill,
    };
  }

  /**
   * 列出所有技能（兼容旧接口）
   */
  async listSkills(filter = {}) {
    const skills = this.manager.listSkills();

    let filtered = skills;

    // 按类型过滤
    if (filter.type) {
      filtered = filtered.filter(s => s.source === filter.type);
    }

    // 按分类过滤
    if (filter.category) {
      filtered = filtered.filter(s => s.category === filter.category);
    }

    return {
      success: true,
      count: filtered.length,
      skills: filtered.map(s => ({
        id: s.name,
        name: s.name,
        description: s.description,
        category: s.category || 'general',
        type: s.source,
      })),
    };
  }

  /**
   * 执行技能（兼容旧接口）
   */
  async executeSkill(skillId, params = {}) {
    try {
      const result = await this.manager.executeSkill(skillId, params);

      return {
        success: result.success,
        skillId: skillId,
        results: result.results,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        skillId: skillId,
        error: error.message,
      };
    }
  }

  /**
   * 创建自定义技能（兼容旧接口）
   */
  async createSkill(skillData) {
    // 新的 Skills 系统不支持动态创建
    // 需要创建文件
    return {
      success: false,
      error: 'Dynamic skill creation not supported. Please create a skill file.',
    };
  }

  /**
   * 搜索技能（兼容旧接口）
   */
  async searchSkills(query) {
    const results = this.manager.searchSkills(query);

    return {
      success: true,
      query: query,
      count: results.length,
      results: results.map(s => ({
        id: s.name,
        name: s.name,
        description: s.description,
        category: s.category || 'general',
        type: s.source,
      })),
    };
  }

  /**
   * 匹配用户输入（新增方法）
   */
  async matchInput(input, options = {}) {
    const match = this.manager.matchInput(input, options);

    if (!match) {
      return {
        success: false,
        error: 'No matching skill found',
        input: input,
      };
    }

    return {
      success: true,
      skill: match.skill,
      score: match.matchResult.score,
      details: match.matchResult.details,
    };
  }

  /**
   * 从用户输入执行（新增方法）
   */
  async executeFromInput(input, options = {}) {
    try {
      const result = await this.manager.executeFromInput(input, options);

      return {
        success: result.success,
        input: input,
        skill: result.skill,
        results: result.results,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        input: input,
        error: error.message,
      };
    }
  }
}

module.exports = SkillSystemAdapter;
