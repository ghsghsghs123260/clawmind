/**
 * status command - Check if Hermes and OpenClaw are running
 */

const chalk = require('chalk');
const path = require('path');
const {
  findProcessByPort,
  checkPortAvailable,
  getProcessInfo,
  readLiveRuntimeMetadata,
  pruneStaleRuntimeMetadata,
} = require('../utils/process');
const { loadConfig, resolveDataDir } = require('../utils/config');

const WEBSOCKET_PORT = 8765;
const SERVICES = ['hermes', 'openclaw'];

function register(program, context) {
  program
    .command('status')
    .description('Check if Hermes and OpenClaw are running')
    .option('--json', 'Output status as JSON')
    .action(async (opts) => {
      await runStatus(context.CLAWMIND_DIR, opts, context);
    });
}

async function runStatus(dataDir, opts = {}, context = {}) {
  const config = loadConfig(dataDir);
  const resolvedDir = resolveDataDir(config);
  const port = config.websocketPort || WEBSOCKET_PORT;

  await pruneStaleRuntimeMetadata(resolvedDir, SERVICES);

  const hermesRuntime = await readLiveRuntimeMetadata(resolvedDir, 'hermes');
  const openclawRuntime = await readLiveRuntimeMetadata(resolvedDir, 'openclaw');
  const portAvailable = await checkPortAvailable(port);
  const portPid = await findProcessByPort(port);
  const portUsedBy = portAvailable ? 'free' : `PID ${portPid || '?'}`;

  if (opts.json) {
    const status = {
      hermes: hermesRuntime
        ? { running: true, pid: hermesRuntime.pid, runtime: hermesRuntime }
        : { running: false },
      openclaw: openclawRuntime
        ? { running: true, pid: openclawRuntime.pid, runtime: openclawRuntime }
        : { running: false },
      port: { number: port, available: portAvailable, usedBy: portUsedBy },
      dataDir: resolvedDir,
    };
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('');
  console.log(`  ${chalk.bold('ClawMind Status')}`);
  console.log(`  ${'─'.repeat(50)}`);
  console.log(`  Data Directory : ${chalk.cyan(resolvedDir)}`);
  console.log('');

  if (hermesRuntime) {
    console.log(`  ${chalk.green('●')} Hermes Agent  : Running  ${chalk.gray(`(WebSocket :${port})`)}`);
    const info = await getProcessInfo(hermesRuntime.pid);
    const memText = info?.mem ? ` | Memory: ${Math.round(info.mem / 1024 / 1024)}MB` : '';
    console.log(`    ${chalk.gray(`PID: ${hermesRuntime.pid}${memText}`)}`);
    if (hermesRuntime.logPaths?.stdout) {
      console.log(`    ${chalk.gray(`Log: ${hermesRuntime.logPaths.stdout}`)}`);
    }
  } else {
    console.log(`  ${chalk.red('○')} Hermes Agent  : Stopped`);
  }

  if (openclawRuntime) {
    console.log(`  ${chalk.green('●')} OpenClaw      : Running  ${chalk.gray(`(PID: ${openclawRuntime.pid})`)}`);
    if (openclawRuntime.logPaths?.stdout) {
      console.log(`    ${chalk.gray(`Log: ${openclawRuntime.logPaths.stdout}`)}`);
    }
  } else {
    console.log(`  ${chalk.red('○')} OpenClaw      : Stopped`);
  }

  console.log('');
  if (portAvailable) {
    console.log(`  ${chalk.cyan('○')} Port ${port}   : Available`);
  } else {
    console.log(`  ${chalk.yellow('●')} Port ${port}   : In use by ${portUsedBy}`);
  }

  const apiKeyValid = config.apiKey && config.apiKey.trim().length >= 20;
  if (apiKeyValid) {
    console.log(`  ${chalk.green('●')} API Key      : Configured ${chalk.gray(`(${config.model || 'unknown model'})`)}`);
  } else {
    console.log(`  ${chalk.yellow('!')} API Key      : Not configured yet`);
  }

  // Skills info
  try {
    const { spawnSync } = require('child_process');
    const skillsPath = path.join(context.PROJECT_ROOT, 'skills', 'cli.js');
    const skillsResult = spawnSync('node', [skillsPath, 'list'], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (skillsResult.status === 0 && skillsResult.stdout.trim()) {
      const skillsData = JSON.parse(skillsResult.stdout.trim());
      console.log(`  ${chalk.green('●')} Skills       : ${skillsData.count} loaded ${chalk.gray('(use "clawmind skill list" for details)')}`);
    }
  } catch (e) {
    // Skills not available, skip
  }

  console.log('');
  console.log(`  ${chalk.gray('Legend: ● running  ○ stopped  ! warning')}`);
  console.log('');
}

module.exports = { register, runStatus };
