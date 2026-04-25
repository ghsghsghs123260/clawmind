/**
 * start command - Start ClawMind services (Hermes + OpenClaw)
 */

const chalk = require('chalk');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const {
  findProcessByPort,
  checkPortAvailable,
  killProcess,
  execPromise,
  ensureDir,
  getServiceLogPaths,
  writeRuntimeMetadata,
  readLiveRuntimeMetadata,
  pruneStaleRuntimeMetadata,
  removeRuntimeMetadata,
} = require('../utils/process');
const { loadConfig, resolveDataDir, ensureDataDir } = require('../utils/config');
const logger = require('../utils/logger');

const WEBSOCKET_PORT = 8765;
const STARTUP_TIMEOUT = 15000;
const SERVICES = ['hermes', 'openclaw'];
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function register(program, context) {
  program
    .command('start')
    .description('Start Hermes and OpenClaw services')
    .option('--skip-health-check', 'Skip pre-start health checks')
    .option('--force', 'Kill existing processes before starting')
    .action(async (opts) => {
      await runStart(context.CLAWMIND_DIR, opts);
    });
}

async function runStart(dataDir, opts = {}) {
  console.log('');
  console.log(`  ${chalk.cyan('ClawMind')} ${chalk.gray('v5.0.0')} — Starting services...`);

  const config = loadConfig(dataDir);
  const resolvedDir = resolveDataDir(config);
  ensureDataDir(resolvedDir);
  await pruneStaleRuntimeMetadata(resolvedDir, SERVICES);

  const port = config.websocketPort || WEBSOCKET_PORT;
  const hermesRuntime = await readLiveRuntimeMetadata(resolvedDir, 'hermes');
  const openclawRuntime = await readLiveRuntimeMetadata(resolvedDir, 'openclaw');
  const hermesPortPid = await findProcessByPort(port);

  if (hermesRuntime || openclawRuntime || hermesPortPid) {
    if (opts.force) {
      console.log(`  ${chalk.yellow('!')} Existing services found, stopping first...`);
      await stopExistingServices(resolvedDir, { hermesRuntime, openclawRuntime, hermesPortPid, port });
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log(`  ${chalk.yellow('!')} Services already running.`);
      console.log(`    Use ${chalk.cyan('clawmind restart')} to restart, or ${chalk.cyan('clawmind start --force')} to kill existing first.`);
      return;
    }
  }

  if (!opts.skipHealthCheck) {
    console.log('');
    console.log(`  ${chalk.bold('Pre-flight checks...')}`);

    const checks = await runPreFlightChecks(config, resolvedDir);
    const failed = checks.filter(c => !c.ok && !c.warning);

    if (failed.length > 0) {
      console.log('');
      for (const check of failed) {
        console.log(`  ${chalk.red('✗')} ${check.label}: ${check.message}`);
      }
      const warnings = checks.filter(c => c.warning);
      for (const check of warnings) {
        console.log(`  ${chalk.yellow('!')} ${check.label}: ${check.message}`);
      }
      console.log('');
      console.log(`  Run ${chalk.cyan('clawmind doctor')} to inspect setup issues.`);
      return;
    }

    for (const check of checks) {
      if (check.ok && !check.warning) {
        console.log(`  ${chalk.green('✓')} ${check.label}`);
      } else if (check.warning) {
        console.log(`  ${chalk.yellow('!')} ${check.label}: ${check.message}`);
      }
    }
  }

  console.log('');
  console.log(`  ${chalk.bold('Starting Hermes Agent...')}`);
  const hermesStarted = await startHermes(config, resolvedDir);
  if (!hermesStarted) {
    console.log(`  ${chalk.red('✗')} Failed to start Hermes Agent`);
    return;
  }
  console.log(`  ${chalk.green('✓')} Hermes Agent started ${chalk.gray(`(PID ${hermesStarted.pid})`)}`);

  console.log(`  ${chalk.bold('Starting OpenClaw...')}`);
  const openclawStarted = await startOpenClaw(config, resolvedDir);
  if (!openclawStarted) {
    removeRuntimeMetadata(resolvedDir, 'hermes');
    try {
      await killProcess(hermesStarted.pid);
    } catch {}
    console.log(`  ${chalk.red('✗')} Failed to start OpenClaw`);
    return;
  }
  console.log(`  ${chalk.green('✓')} OpenClaw started ${chalk.gray(`(PID ${openclawStarted.pid})`)}`);

  console.log('');
  console.log(`  ${chalk.bold('Waiting for services to be ready...')}`);
  const ready = await waitForServices(STARTUP_TIMEOUT, resolvedDir, port);

  console.log('');
  if (ready) {
    console.log(`  ${chalk.green('✓')} All services running`);
    console.log(`  ${chalk.cyan('  ClawMind is ready!')}`);
    console.log(`  ${chalk.gray(`  WebSocket: ws://localhost:${port}`)}`);
  } else {
    console.log(`  ${chalk.yellow('!')} Services started but may not be fully ready yet.`);
    console.log(`    Run ${chalk.cyan('clawmind status')} to verify.`);
  }
  console.log('');
}

async function runPreFlightChecks(config, dataDir) {
  const checks = [];
  const port = config.websocketPort || WEBSOCKET_PORT;

  try {
    const pyVersion = await execPromise('python --version 2>&1');
    checks.push({ label: 'Python', ok: true, message: pyVersion });
  } catch {
    checks.push({ label: 'Python', ok: false, message: 'Not found in PATH' });
  }

  try {
    const nodeVersion = await execPromise('node --version');
    checks.push({ label: 'Node.js', ok: true, message: nodeVersion });
  } catch {
    checks.push({ label: 'Node.js', ok: false, message: 'Not found in PATH' });
  }

  const portFree = await checkPortAvailable(port);
  checks.push({
    label: `Port ${port}`,
    ok: portFree,
    message: portFree ? 'Available' : 'Already in use',
  });

  try {
    ensureDataDir(dataDir);
    ensureDir(path.join(dataDir, 'logs'));
    ensureDir(path.join(dataDir, 'runtime'));
    checks.push({ label: 'Data directory', ok: true, message: dataDir });
  } catch {
    checks.push({ label: 'Data directory', ok: false, message: `Cannot create: ${dataDir}` });
  }

  if (config.apiKey && config.apiKey.trim().length >= 20) {
    checks.push({ label: 'API Key', ok: true, message: 'Configured' });
  } else {
    checks.push({ label: 'API Key', ok: true, warning: true, message: 'Not configured yet; model integration can be added later' });
  }

  return checks;
}

async function stopExistingServices(dataDir, { hermesRuntime, openclawRuntime, hermesPortPid, port }) {
  if (openclawRuntime?.pid) {
    try {
      await killProcess(openclawRuntime.pid);
      console.log(`  ${chalk.gray(`  Stopped OpenClaw (PID ${openclawRuntime.pid})`)}`);
    } catch (err) {
      logger.warn('start', 'Failed to stop existing OpenClaw process', { error: err.message, pid: openclawRuntime.pid });
    }
    removeRuntimeMetadata(dataDir, 'openclaw');
  }

  if (hermesRuntime?.pid) {
    try {
      await killProcess(hermesRuntime.pid);
      console.log(`  ${chalk.gray(`  Stopped Hermes (PID ${hermesRuntime.pid})`)}`);
    } catch (err) {
      logger.warn('start', 'Failed to stop existing Hermes process', { error: err.message, pid: hermesRuntime.pid });
    }
    removeRuntimeMetadata(dataDir, 'hermes');
  }

  if (hermesPortPid && hermesPortPid !== hermesRuntime?.pid) {
    try {
      await killProcess(hermesPortPid);
      console.log(`  ${chalk.gray(`  Freed port ${port} (PID ${hermesPortPid})`)}`);
    } catch (err) {
      logger.warn('start', 'Failed to stop process using websocket port', { error: err.message, pid: hermesPortPid });
    }
  }
}

function spawnDetached(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio,
    detached: true,
    windowsHide: true,
  });

  child.unref();
  return child;
}

async function startHermes(config, dataDir) {
  const port = config.websocketPort || WEBSOCKET_PORT;
  const hermesScript = path.join(PROJECT_ROOT, 'hermes', 'server.py');
  const hermesDataDir = config.hermes?.dataDir
    ? path.resolve(config.hermes.dataDir)
    : path.join(dataDir, 'hermes');
  ensureDir(hermesDataDir);

  const logs = getServiceLogPaths(dataDir, 'hermes');
  const stdout = fs.openSync(logs.stdout, 'a');
  const stderr = fs.openSync(logs.stderr, 'a');
  const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
  const child = spawnDetached(pythonCmd, [hermesScript], {
    cwd: path.dirname(hermesScript),
    env: {
      ...process.env,
      CLAWMIND_DIR: dataDir,
      CLAWMIND_HERMES_DIR: hermesDataDir,
      CLAWMIND_WEBSOCKET_PORT: String(port),
    },
    stdio: ['ignore', stdout, stderr],
  });

  writeRuntimeMetadata(dataDir, 'hermes', {
    pid: child.pid,
    command: pythonCmd,
    args: [hermesScript],
    cwd: path.dirname(hermesScript),
    logPaths: logs,
    startedAt: new Date().toISOString(),
  });

  return { pid: child.pid, logs };
}

async function startOpenClaw(config, dataDir) {
  const port = config.websocketPort || WEBSOCKET_PORT;
  const openclawScript = path.join(PROJECT_ROOT, 'openclaw', 'client.js');
  const openclawDataDir = config.openclaw?.dataDir
    ? path.resolve(config.openclaw.dataDir)
    : path.join(dataDir, 'openclaw');
  ensureDir(openclawDataDir);

  const logs = getServiceLogPaths(dataDir, 'openclaw');
  const stdout = fs.openSync(logs.stdout, 'a');
  const stderr = fs.openSync(logs.stderr, 'a');
  const child = spawnDetached('node', [openclawScript], {
    cwd: path.dirname(openclawScript),
    env: {
      ...process.env,
      CLAWMIND_DIR: dataDir,
      CLAWMIND_OPENCLAW_DIR: openclawDataDir,
      CLAWMIND_WEBSOCKET_URL: `ws://localhost:${port}`,
    },
    stdio: ['ignore', stdout, stderr],
  });

  writeRuntimeMetadata(dataDir, 'openclaw', {
    pid: child.pid,
    command: 'node',
    args: [openclawScript],
    cwd: path.dirname(openclawScript),
    logPaths: logs,
    startedAt: new Date().toISOString(),
  });

  return { pid: child.pid, logs };
}

async function waitForServices(timeout, dataDir, port) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hermes = await readLiveRuntimeMetadata(dataDir, 'hermes');
    const openclaw = await readLiveRuntimeMetadata(dataDir, 'openclaw');
    const portFree = await checkPortAvailable(port);
    if (hermes && openclaw && !portFree) {
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

module.exports = { register, runStart, runPreFlightChecks };
