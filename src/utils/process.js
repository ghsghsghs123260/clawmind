/**
 * Process management utilities for ClawMind
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

const IS_WINDOWS = os.platform() === 'win32';
const RUNTIME_DIR = 'runtime';
const LOGS_DIR = 'logs';

function execPromise(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = { shell: true, ...options };
    exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getRuntimeDir(dataDir) {
  return path.join(dataDir, RUNTIME_DIR);
}

function getLogsDir(dataDir) {
  return path.join(dataDir, LOGS_DIR);
}

function getRuntimeFile(dataDir, serviceName) {
  return path.join(getRuntimeDir(dataDir), `${serviceName}.json`);
}

function getServiceLogPaths(dataDir, serviceName) {
  const logsDir = getLogsDir(dataDir);
  ensureDir(logsDir);
  return {
    stdout: path.join(logsDir, `${serviceName}.out.log`),
    stderr: path.join(logsDir, `${serviceName}.err.log`),
  };
}

function writeRuntimeMetadata(dataDir, serviceName, metadata) {
  ensureDir(getRuntimeDir(dataDir));
  const runtimeFile = getRuntimeFile(dataDir, serviceName);
  fs.writeFileSync(runtimeFile, JSON.stringify({ service: serviceName, ...metadata }, null, 2), 'utf8');
  logger.info('process', `Wrote runtime metadata: ${runtimeFile}`);
  return runtimeFile;
}

function readRuntimeMetadata(dataDir, serviceName) {
  const runtimeFile = getRuntimeFile(dataDir, serviceName);
  if (!fs.existsSync(runtimeFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  } catch (err) {
    logger.warn('process', `Failed to parse runtime metadata: ${runtimeFile}`, { error: err.message });
    return null;
  }
}

function removeRuntimeMetadata(dataDir, serviceName) {
  const runtimeFile = getRuntimeFile(dataDir, serviceName);
  if (fs.existsSync(runtimeFile)) {
    fs.unlinkSync(runtimeFile);
    logger.info('process', `Removed runtime metadata: ${runtimeFile}`);
  }
}

async function readLiveRuntimeMetadata(dataDir, serviceName) {
  const metadata = readRuntimeMetadata(dataDir, serviceName);
  if (!metadata) {
    return null;
  }

  const running = await isProcessRunning(metadata.pid);
  if (!running) {
    removeRuntimeMetadata(dataDir, serviceName);
    return null;
  }

  return metadata;
}

async function pruneStaleRuntimeMetadata(dataDir, serviceNames = []) {
  const stale = [];
  for (const serviceName of serviceNames) {
    const metadata = readRuntimeMetadata(dataDir, serviceName);
    if (!metadata) {
      continue;
    }

    const running = await isProcessRunning(metadata.pid);
    if (!running) {
      removeRuntimeMetadata(dataDir, serviceName);
      stale.push(serviceName);
    }
  }
  return stale;
}

async function findProcessByPort(port) {
  if (IS_WINDOWS) {
    try {
      const output = await execPromise(`netstat -ano | findstr :${port}`);
      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const localAddr = parts[1];
          const state = parts[3];
          const pid = parseInt(parts[4], 10);
          if (localAddr && localAddr.includes(`:${port}`) && state === 'LISTENING' && pid > 0) {
            return pid;
          }
        }
      }
    } catch {
      // Port not in use
    }
    return null;
  } else {
    try {
      const output = await execPromise(`lsof -ti:${port}`);
      return parseInt(output, 10);
    } catch {
      return null;
    }
  }
}

async function findProcessByName(name) {
  if (IS_WINDOWS) {
    try {
      const output = await execPromise(`tasklist /FI "IMAGENAME eq ${name}*" /FO CSV /NH`);
      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split(',').map(s => s.replace(/"/g, '').trim());
        if (parts.length >= 2) {
          return { name: parts[0], pid: parseInt(parts[1], 10) };
        }
      }
    } catch {
      // Not found
    }
    return null;
  } else {
    try {
      const output = await execPromise(`pgrep -f "${name}"`);
      const pid = parseInt(output, 10);
      return pid ? { name, pid } : null;
    } catch {
      return null;
    }
  }
}

async function killProcess(pid) {
  if (IS_WINDOWS) {
    await execPromise(`taskkill /PID ${pid} /F`);
  } else {
    await execPromise(`kill -9 ${pid}`);
  }
}

async function isProcessRunning(pid) {
  if (!pid) return false;
  if (IS_WINDOWS) {
    try {
      const output = await execPromise(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
      return !output.includes('No tasks are running') && !output.includes('没有运行的任务') && output.includes(`"${pid}"`);
    } catch {
      return false;
    }
  } else {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}

async function checkPortAvailable(port) {
  const pid = await findProcessByPort(port);
  return pid === null;
}

async function getProcessInfo(pid) {
  if (!pid) return null;
  if (IS_WINDOWS) {
    try {
      const output = await execPromise(`wmic process where ProcessId=${pid} get Name,CommandLine,WorkingSetSize /format:csv`);
      const lines = output.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        const parts = lines[1].split(',');
        return {
          pid,
          name: parts[1] || 'unknown',
          cmd: parts[2] || '',
          mem: parseInt(parts[3] || '0', 10),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  execPromise,
  ensureDir,
  getRuntimeDir,
  getLogsDir,
  getRuntimeFile,
  getServiceLogPaths,
  writeRuntimeMetadata,
  readRuntimeMetadata,
  readLiveRuntimeMetadata,
  removeRuntimeMetadata,
  pruneStaleRuntimeMetadata,
  findProcessByPort,
  findProcessByName,
  killProcess,
  isProcessRunning,
  checkPortAvailable,
  getProcessInfo,
  IS_WINDOWS,
};
