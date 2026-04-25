/**
 * 统一配置管理器
 * 负责配置的加载、保存、验证和迁移
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置文件优先级
const CONFIG_PRIORITY = [
  // 1. 环境变量指定的路径
  () => process.env.CLAWMIND_CONFIG,
  // 2. 用户目录
  () => path.join(os.homedir(), 'ClawMind', 'config.json'),
  // 3. Windows APPDATA
  () => process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'ClawMind', 'config.json')
    : null,
  // 4. 项目目录（只读模板）
  () => path.join(__dirname, '..', '..', 'config', 'config.default.json'),
];

// 标准配置格式
const CONFIG_SCHEMA = {
  version: '5.0.0',
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4',
  apiEndpoint: 'https://api.openai.com/v1',
  authHeaderName: 'Authorization',
  authHeaderValuePrefix: 'Bearer ',
  websocketPort: 8765,
  dataDir: null, // null = 使用默认
  hermes: {
    enabled: true,
    dataDir: null,
  },
  openclaw: {
    enabled: true,
    dataDir: null,
  },
  execution: {
    mode: 'serial',
    retryCount: 3,
    stepTimeoutSec: 300,
    taskTimeoutSec: 3600,
  },
  trustMode: {
    enabled: false,
    duration: '10m',
  },
  logging: {
    level: 'info',
    maxFiles: 7,
  },
  notifications: {
    enabled: true,
    sound: true,
  },
  language: 'zh',
};

// 提供商预设
const PROVIDER_PRESETS = {
  openai: {
    apiEndpoint: 'https://api.openai.com/v1',
    authHeaderName: 'Authorization',
    authHeaderValuePrefix: 'Bearer ',
    model: 'gpt-4',
  },
  anthropic: {
    apiEndpoint: 'https://api.anthropic.com/v1',
    authHeaderName: 'x-api-key',
    authHeaderValuePrefix: '',
    model: 'claude-3-opus-20240229',
  },
  azure: {
    apiEndpoint: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>',
    authHeaderName: 'api-key',
    authHeaderValuePrefix: '',
    model: 'gpt-4',
  },
  custom: {
    apiEndpoint: '',
    authHeaderName: 'Authorization',
    authHeaderValuePrefix: 'Bearer ',
    model: '',
  },
};

class ConfigManager {
  constructor() {
    this.configPath = null;
    this.config = null;
  }

  /**
   * 查找配置文件路径
   */
  findConfigPath() {
    for (const getPath of CONFIG_PRIORITY) {
      const configPath = getPath();
      if (configPath && fs.existsSync(configPath)) {
        return configPath;
      }
    }
    // 如果都不存在，返回默认用户目录路径
    return path.join(os.homedir(), 'ClawMind', 'config.json');
  }

  /**
   * 加载配置
   */
  load() {
    this.configPath = this.findConfigPath();

    if (!fs.existsSync(this.configPath)) {
      console.warn(`Config file not found: ${this.configPath}`);
      this.config = this.getDefaultConfig();
      return this.config;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const rawConfig = JSON.parse(content);

      // 检查是否需要迁移
      if (this.needsMigration(rawConfig)) {
        console.log('Migrating config to new format...');
        this.config = this.migrateConfig(rawConfig);
        this.save(); // 保存迁移后的配置
      } else {
        this.config = this.mergeWithDefaults(rawConfig);
      }

      // 验证配置
      this.validate();

      return this.config;
    } catch (error) {
      console.error(`Failed to load config: ${error.message}`);
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * 保存配置
   */
  save(config = null) {
    if (config) {
      this.config = this.mergeWithDefaults(config);
    }

    if (!this.config) {
      throw new Error('No config to save');
    }

    // 确保有配置路径
    if (!this.configPath) {
      this.configPath = this.findConfigPath();
    }

    // 确保目录存在
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存配置
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );

    console.log(`Config saved to: ${this.configPath}`);
    return this.configPath;
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return JSON.parse(JSON.stringify(CONFIG_SCHEMA));
  }

  /**
   * 合并默认值
   */
  mergeWithDefaults(config) {
    const merged = JSON.parse(JSON.stringify(CONFIG_SCHEMA));

    // 递归合并
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };

    deepMerge(merged, config);
    return merged;
  }

  /**
   * 检查是否需要迁移
   */
  needsMigration(config) {
    // 旧格式特征：缺少 provider 字段，或者有 dataPath 字段
    return !config.provider || config.dataPath !== undefined;
  }

  /**
   * 迁移旧配置到新格式
   */
  migrateConfig(oldConfig) {
    const newConfig = this.getDefaultConfig();

    // 迁移基本字段
    if (oldConfig.apiKey) newConfig.apiKey = oldConfig.apiKey;
    if (oldConfig.model) newConfig.model = oldConfig.model;
    if (oldConfig.apiEndpoint) newConfig.apiEndpoint = oldConfig.apiEndpoint;

    // 迁移 WebSocket 配置
    if (oldConfig.websocket?.port) {
      newConfig.websocketPort = oldConfig.websocket.port;
    } else if (oldConfig.websocketPort) {
      newConfig.websocketPort = oldConfig.websocketPort;
    }

    // 迁移数据目录
    if (oldConfig.dataPath) {
      newConfig.dataDir = oldConfig.dataPath;
    } else if (oldConfig.dataDir) {
      newConfig.dataDir = oldConfig.dataDir;
    }

    // 迁移 Hermes 配置
    if (oldConfig.hermes) {
      newConfig.hermes = { ...newConfig.hermes, ...oldConfig.hermes };
    }

    // 迁移 OpenClaw 配置
    if (oldConfig.openclaw) {
      newConfig.openclaw = { ...newConfig.openclaw, ...oldConfig.openclaw };
    }

    // 迁移执行配置
    if (oldConfig.execution) {
      newConfig.execution = { ...newConfig.execution, ...oldConfig.execution };
    }

    // 迁移信任模式
    if (oldConfig.trustMode) {
      newConfig.trustMode = { ...newConfig.trustMode, ...oldConfig.trustMode };
    }

    // 迁移日志配置
    if (oldConfig.logging) {
      newConfig.logging = { ...newConfig.logging, ...oldConfig.logging };
    }

    // 推断 provider
    if (!newConfig.provider) {
      if (newConfig.apiEndpoint.includes('openai.com')) {
        newConfig.provider = 'openai';
      } else if (newConfig.apiEndpoint.includes('anthropic.com')) {
        newConfig.provider = 'anthropic';
      } else if (newConfig.apiEndpoint.includes('azure.com')) {
        newConfig.provider = 'azure';
      } else {
        newConfig.provider = 'custom';
      }
    }

    // 推断认证头
    if (!oldConfig.authHeaderName) {
      const preset = PROVIDER_PRESETS[newConfig.provider];
      if (preset) {
        newConfig.authHeaderName = preset.authHeaderName;
        newConfig.authHeaderValuePrefix = preset.authHeaderValuePrefix;
      }
    }

    return newConfig;
  }

  /**
   * 验证配置
   */
  validate() {
    const errors = [];

    // 必需字段检查
    if (!this.config.apiEndpoint) {
      errors.push('apiEndpoint is required');
    }

    if (!this.config.model) {
      errors.push('model is required');
    }

    if (!this.config.authHeaderName) {
      errors.push('authHeaderName is required');
    }

    // 端口检查
    if (this.config.websocketPort < 1024 || this.config.websocketPort > 65535) {
      errors.push('websocketPort must be between 1024 and 65535');
    }

    // API Key 检查（警告）
    if (!this.config.apiKey || this.config.apiKey.length < 10) {
      console.warn('Warning: API Key is not configured or too short');
    }

    if (errors.length > 0) {
      throw new Error(`Config validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * 应用提供商预设
   */
  applyProviderPreset(provider) {
    const preset = PROVIDER_PRESETS[provider];
    if (!preset) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    this.config.provider = provider;
    this.config.apiEndpoint = preset.apiEndpoint;
    this.config.authHeaderName = preset.authHeaderName;
    this.config.authHeaderValuePrefix = preset.authHeaderValuePrefix;
    this.config.model = preset.model;

    return this.config;
  }

  /**
   * 获取配置值
   */
  get(key, defaultValue = null) {
    if (!this.config) {
      this.load();
    }

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    if (!this.config) {
      this.load();
    }

    const keys = key.split('.');
    let target = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
    return this.config;
  }

  /**
   * 获取配置路径
   */
  getConfigPath() {
    if (!this.configPath) {
      this.configPath = this.findConfigPath();
    }
    return this.configPath;
  }

  /**
   * 导出配置（用于备份）
   */
  export(filePath) {
    if (!this.config) {
      this.load();
    }

    fs.writeFileSync(
      filePath,
      JSON.stringify(this.config, null, 2),
      'utf-8'
    );

    console.log(`Config exported to: ${filePath}`);
  }

  /**
   * 导入配置
   */
  import(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importedConfig = JSON.parse(content);

    this.config = this.mergeWithDefaults(importedConfig);
    this.validate();
    this.save();

    console.log(`Config imported from: ${filePath}`);
  }

  /**
   * 重置为默认配置
   */
  reset() {
    this.config = this.getDefaultConfig();
    this.save();
    console.log('Config reset to defaults');
  }
}

// 单例模式
let instance = null;

function getConfigManager() {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

module.exports = {
  ConfigManager,
  getConfigManager,
  PROVIDER_PRESETS,
  CONFIG_SCHEMA,
};
