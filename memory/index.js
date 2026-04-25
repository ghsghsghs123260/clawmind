const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * 记忆系统
 * 用于存储和检索对话历史、用户偏好、任务记录等
 */
class MemorySystem {
  constructor(dataPath = '../data/memory') {
    this.dataPath = path.resolve(__dirname, dataPath);
    this.conversationsPath = path.join(this.dataPath, 'conversations');
    this.preferencesPath = path.join(this.dataPath, 'preferences');
    this.tasksPath = path.join(this.dataPath, 'tasks');
    this.knowledgePath = path.join(this.dataPath, 'knowledge');

    this._ready = this.init();
  }

  get ready() {
    return this._ready;
  }

  /**
   * 初始化目录结构
   */
  async init() {
    const dirs = [
      this.dataPath,
      this.conversationsPath,
      this.preferencesPath,
      this.tasksPath,
      this.knowledgePath
    ];

    for (const dir of dirs) {
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  // ==================== 对话历史 ====================

  /**
   * 保存对话
   */
  async saveConversation(conversationId, messages) {
    const filePath = path.join(this.conversationsPath, `${conversationId}.json`);

    const data = {
      id: conversationId,
      messages: messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      conversationId: conversationId,
      messageCount: messages.length
    };
  }

  /**
   * 加载对话
   */
  async loadConversation(conversationId) {
    const filePath = path.join(this.conversationsPath, `${conversationId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        success: true,
        conversation: data
      };
    } catch (error) {
      throw new Error(`加载对话失败: ${error.message}`);
    }
  }

  /**
   * 列出所有对话
   */
  async listConversations() {
    try {
      const files = await fs.readdir(this.conversationsPath);
      const conversations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.conversationsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          conversations.push({
            id: data.id,
            messageCount: data.messages.length,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        }
      }

      // 按更新时间倒序排列
      conversations.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        success: true,
        count: conversations.length,
        conversations: conversations
      };
    } catch (error) {
      throw new Error(`列出对话失败: ${error.message}`);
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId) {
    const filePath = path.join(this.conversationsPath, `${conversationId}.json`);

    try {
      await fs.unlink(filePath);

      return {
        success: true,
        conversationId: conversationId
      };
    } catch (error) {
      throw new Error(`删除对话失败: ${error.message}`);
    }
  }

  // ==================== 用户偏好 ====================

  /**
   * 保存用户偏好
   */
  async savePreference(key, value) {
    const filePath = path.join(this.preferencesPath, 'preferences.json');

    let preferences = {};

    // 读取现有偏好
    if (fsSync.existsSync(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      preferences = JSON.parse(content);
    }

    // 更新偏好
    preferences[key] = {
      value: value,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(preferences, null, 2), 'utf-8');

    return {
      success: true,
      key: key,
      value: value
    };
  }

  /**
   * 获取用户偏好
   */
  async getPreference(key) {
    const filePath = path.join(this.preferencesPath, 'preferences.json');

    try {
      if (!fsSync.existsSync(filePath)) {
        return {
          success: true,
          key: key,
          value: null
        };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const preferences = JSON.parse(content);

      return {
        success: true,
        key: key,
        value: preferences[key]?.value || null,
        updatedAt: preferences[key]?.updatedAt || null
      };
    } catch (error) {
      throw new Error(`获取偏好失败: ${error.message}`);
    }
  }

  /**
   * 获取所有偏好
   */
  async getAllPreferences() {
    const filePath = path.join(this.preferencesPath, 'preferences.json');

    try {
      if (!fsSync.existsSync(filePath)) {
        return {
          success: true,
          preferences: {}
        };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const preferences = JSON.parse(content);

      return {
        success: true,
        preferences: preferences
      };
    } catch (error) {
      throw new Error(`获取所有偏好失败: ${error.message}`);
    }
  }

  // ==================== 任务记录 ====================

  /**
   * 保存任务
   */
  async saveTask(taskId, taskData) {
    const filePath = path.join(this.tasksPath, `${taskId}.json`);

    const data = {
      id: taskId,
      ...taskData,
      createdAt: taskData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      taskId: taskId
    };
  }

  /**
   * 加载任务
   */
  async loadTask(taskId) {
    const filePath = path.join(this.tasksPath, `${taskId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        success: true,
        task: data
      };
    } catch (error) {
      throw new Error(`加载任务失败: ${error.message}`);
    }
  }

  /**
   * 列出所有任务
   */
  async listTasks(filter = {}) {
    try {
      const files = await fs.readdir(this.tasksPath);
      const tasks = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.tasksPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // 应用过滤器
          if (filter.status && data.status !== filter.status) {
            continue;
          }

          tasks.push(data);
        }
      }

      // 按创建时间倒序排列
      tasks.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return {
        success: true,
        count: tasks.length,
        tasks: tasks
      };
    } catch (error) {
      throw new Error(`列出任务失败: ${error.message}`);
    }
  }

  // ==================== 知识库 ====================

  /**
   * 保存知识条目
   */
  async saveKnowledge(category, key, content) {
    const categoryPath = path.join(this.knowledgePath, category);

    if (!fsSync.existsSync(categoryPath)) {
      await fs.mkdir(categoryPath, { recursive: true });
    }

    const filePath = path.join(categoryPath, `${key}.json`);

    const data = {
      category: category,
      key: key,
      content: content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      category: category,
      key: key
    };
  }

  /**
   * 获取知识条目
   */
  async getKnowledge(category, key) {
    const filePath = path.join(this.knowledgePath, category, `${key}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        success: true,
        knowledge: data
      };
    } catch (error) {
      throw new Error(`获取知识失败: ${error.message}`);
    }
  }

  /**
   * 搜索知识库
   */
  async searchKnowledge(query) {
    try {
      const results = [];
      const categories = await fs.readdir(this.knowledgePath);

      for (const category of categories) {
        const categoryPath = path.join(this.knowledgePath, category);
        const stats = await fs.stat(categoryPath);

        if (!stats.isDirectory()) continue;

        const files = await fs.readdir(categoryPath);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = path.join(categoryPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // 简单的文本匹配
          const searchText = JSON.stringify(data).toLowerCase();
          if (searchText.includes(query.toLowerCase())) {
            results.push(data);
          }
        }
      }

      return {
        success: true,
        query: query,
        count: results.length,
        results: results
      };
    } catch (error) {
      throw new Error(`搜索知识库失败: ${error.message}`);
    }
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      const conversationFiles = await fs.readdir(this.conversationsPath);
      const taskFiles = await fs.readdir(this.tasksPath);

      const conversationCount = conversationFiles.filter(f => f.endsWith('.json')).length;
      const taskCount = taskFiles.filter(f => f.endsWith('.json')).length;

      let preferenceCount = 0;
      const prefFilePath = path.join(this.preferencesPath, 'preferences.json');
      if (fsSync.existsSync(prefFilePath)) {
        try {
          const prefs = JSON.parse(fsSync.readFileSync(prefFilePath, 'utf-8'));
          preferenceCount = Object.keys(prefs).length;
        } catch {}
      }

      return {
        success: true,
        stats: {
          conversations: conversationCount,
          tasks: taskCount,
          preferences: preferenceCount
        }
      };
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }
}

module.exports = MemorySystem;
