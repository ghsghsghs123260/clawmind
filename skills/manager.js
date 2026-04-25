/**
 * Skills System - 完整实现
 * 管理和执行技能
 */

const fs = require('fs');
const path = require('path');
const { loadSkillFromFile, validateSkill } = require('./parser');
const { findBestMatch, findAllMatches, extractParameters } = require('./matcher');
const SkillExecutor = require('./executor');

class SkillManager {
  constructor(actionExecutor) {
    this.skills = new Map();
    this.executor = new SkillExecutor(actionExecutor);
    this.builtinPath = path.join(__dirname, 'builtin');
    this.customPath = null;
  }

  /**
   * 设置自定义 Skills 目录
   * @param {string} customPath - 自定义目录路径
   */
  setCustomPath(customPath) {
    this.customPath = customPath;
  }

  /**
   * 加载所有 Skills
   * @param {Object} options - 加载选项
   */
  async loadAll(options = {}) {
    const { includeBuiltin = true, includeCustom = true } = options;

    // 加载内置 Skills
    if (includeBuiltin && fs.existsSync(this.builtinPath)) {
      await this.loadFromDirectory(this.builtinPath, 'builtin');
    }

    // 加载自定义 Skills
    if (includeCustom && this.customPath && fs.existsSync(this.customPath)) {
      await this.loadFromDirectory(this.customPath, 'custom');
    }

    console.log(`Loaded ${this.skills.size} skills`);
  }

  /**
   * 从目录加载 Skills
   * @param {string} dirPath - 目录路径
   * @param {string} source - 来源标识
   */
  async loadFromDirectory(dirPath, source = 'unknown') {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile() && (file.endsWith('.json') || file.endsWith('.md'))) {
        try {
          const skill = loadSkillFromFile(filePath);
          const validation = validateSkill(skill);

          if (validation.valid) {
            skill.source = source;
            skill.filePath = filePath;
            this.skills.set(skill.name, skill);
            console.log(`  ✓ Loaded skill: ${skill.name}`);
          } else {
            console.warn(`  ✗ Invalid skill ${file}:`, validation.errors);
          }
        } catch (error) {
          console.error(`  ✗ Failed to load ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * 加载单个 Skill
   * @param {string} filePath - 文件路径
   */
  loadSkill(filePath) {
    const skill = loadSkillFromFile(filePath);
    const validation = validateSkill(skill);

    if (!validation.valid) {
      throw new Error(`Invalid skill: ${validation.errors.join(', ')}`);
    }

    this.skills.set(skill.name, skill);
    return skill;
  }

  /**
   * 获取 Skill
   * @param {string} name - Skill 名称
   * @returns {Object|null} Skill 对象
   */
  getSkill(name) {
    return this.skills.get(name) || null;
  }

  /**
   * 列出所有 Skills
   * @returns {Array} Skill 列表
   */
  listSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * 搜索 Skills
   * @param {string} query - 搜索关键词
   * @returns {Array} 匹配的 Skill 列表
   */
  searchSkills(query) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const skill of this.skills.values()) {
      if (
        skill.name.toLowerCase().includes(queryLower) ||
        skill.description.toLowerCase().includes(queryLower)
      ) {
        results.push(skill);
      }
    }

    return results;
  }

  /**
   * 匹配用户输入到 Skill
   * @param {string} input - 用户输入
   * @param {Object} options - 匹配选项
   * @returns {Object|null} 匹配结果
   */
  matchInput(input, options = {}) {
    const { threshold = 0.3, findAll = false } = options;
    const skillList = this.listSkills();

    if (findAll) {
      return findAllMatches(input, skillList, threshold);
    } else {
      return findBestMatch(input, skillList, threshold);
    }
  }

  /**
   * 执行 Skill
   * @param {string} skillName - Skill 名称
   * @param {Object} params - 参数
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async executeSkill(skillName, params = {}, options = {}) {
    const skill = this.getSkill(skillName);

    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    return await this.executor.executeSkill(skill, params, options);
  }

  /**
   * 根据用户输入执行 Skill
   * @param {string} input - 用户输入
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 执行结果
   */
  async executeFromInput(input, options = {}) {
    // 匹配 Skill
    const match = this.matchInput(input, options);

    if (!match) {
      return {
        success: false,
        error: 'No matching skill found',
        input,
      };
    }

    const { skill, matchResult } = match;

    // 提取参数
    const captures = matchResult.details.patterns.captures || {};
    const params = extractParameters(input, skill.parameters, captures);

    // 执行 Skill
    return await this.executeSkill(skill.name, params, options);
  }

  /**
   * 获取执行历史
   * @param {number} limit - 返回数量限制
   * @returns {Array} 执行历史
   */
  getExecutionHistory(limit = 10) {
    return this.executor.getExecutionHistory(limit);
  }

  /**
   * 监听执行事件
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理器
   */
  on(event, handler) {
    this.executor.on(event, handler);
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理器
   */
  off(event, handler) {
    this.executor.off(event, handler);
  }
}

module.exports = SkillManager;
