/**
 * Config module - thin wrapper over ConfigManager
 * 保持原有的函数签名以兼容现有调用方
 */

const path = require('path');
const os = require('os');
const { ConfigManager, PROVIDER_PRESETS } = require('./config-manager');

const CONFIG_FILE = 'config.json';

function getDefaultDataDir() {
  return path.join(os.homedir(), 'ClawMind');
}

function resolveDataDir(config) {
  if (config.dataDir) {
    return path.resolve(config.dataDir);
  }
  return getDefaultDataDir();
}

function configPath(dataDir) {
  return path.join(dataDir, CONFIG_FILE);
}

function ensureDataDir(dataDir) {
  const fs = require('fs');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadConfig(dataDir) {
  if (!dataDir) dataDir = getDefaultDataDir();
  const cfgPath = configPath(dataDir);
  const mgr = new ConfigManager();
  mgr.configPath = cfgPath;

  const fs = require('fs');
  if (!fs.existsSync(cfgPath)) {
    mgr.config = mgr.getDefaultConfig();
  } else {
    mgr.config = mgr.mergeWithDefaults(
      JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    );
  }

  return { ...mgr.config, dataDir };
}

function saveConfig(dataDir, config) {
  if (!dataDir) dataDir = getDefaultDataDir();
  ensureDataDir(dataDir);
  const fs = require('fs');
  fs.writeFileSync(configPath(dataDir), JSON.stringify(config, null, 2), 'utf8');
}

function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, message: 'API Key is empty or not a string' };
  }
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    return { valid: false, message: 'API Key appears too short' };
  }
  return { valid: true, key: trimmed };
}

function validateConfig(config) {
  const errors = [];
  const warnings = [];
  const fs = require('fs');

  if (typeof config.websocketPort !== 'number' || config.websocketPort < 1024 || config.websocketPort > 65535) {
    errors.push('WebSocket port must be a number between 1024 and 65535');
  }

  if (config.dataDir && fs.existsSync(config.dataDir)) {
    try {
      fs.accessSync(config.dataDir, fs.constants.W_OK);
    } catch {
      errors.push(`Data directory is not writable: ${config.dataDir}`);
    }
  }

  const apiKeyResult = validateApiKey(config.apiKey || '');
  if (!apiKeyResult.valid) {
    warnings.push(`API Key: ${apiKeyResult.message}`);
  }

  return { errors, warnings };
}

const DEFAULT_CONFIG = new ConfigManager().getDefaultConfig();

module.exports = {
  DEFAULT_CONFIG,
  getDefaultDataDir,
  resolveDataDir,
  configPath,
  ensureDataDir,
  loadConfig,
  saveConfig,
  validateApiKey,
  validateConfig,
  PROVIDER_PRESETS,
};
