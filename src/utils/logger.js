/**
 * Logger utility for ClawMind CLI
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

let currentLevel = LOG_LEVELS.INFO;

function setLevel(level) {
  if (typeof level === 'string') {
    currentLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
  } else {
    currentLevel = level;
  }
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function format(level, tag, message, data) {
  const prefix = `[${timestamp()}] [${level}] [${tag}]`;
  if (data !== undefined) {
    return `${prefix} ${message}\n  Data: ${JSON.stringify(data, null, 2)}`;
  }
  return `${prefix} ${message}`;
}

const logger = {
  error(tag, message, data) {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(format('ERROR', tag, message, data));
    }
  },

  warn(tag, message, data) {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(format('WARN', tag, message, data));
    }
  },

  info(tag, message, data) {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(format('INFO', tag, message, data));
    }
  },

  debug(tag, message, data) {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(format('DEBUG', tag, message, data));
    }
  },

  setLevel,
  LOG_LEVELS,
};

module.exports = logger;
