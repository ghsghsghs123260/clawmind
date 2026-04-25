/**
 * stop command - Stop all ClawMind services
 */

const chalk = require('chalk');
const {
  findProcessByPort,
  killProcess,
  readLiveRuntimeMetadata,
  pruneStaleRuntimeMetadata,
  removeRuntimeMetadata,
} = require('../utils/process');
const { loadConfig, resolveDataDir } = require('../utils/config');

const WEBSOCKET_PORT = 8765;
const SERVICES = ['hermes', 'openclaw'];

function register(program, context) {
  program
    .command('stop')
    .description('Stop Hermes and OpenClaw services')
    .option('--force', 'Force kill running services')
    .action(async (opts) => {
      await runStop(context.CLAWMIND_DIR, opts);
    });
}

async function runStop(dataDir, opts = {}) {
  const config = loadConfig(dataDir);
  const resolvedDir = resolveDataDir(config);
  const port = config.websocketPort || WEBSOCKET_PORT;

  console.log('');
  console.log(`  ${chalk.cyan('ClawMind')} — Stopping services...`);

  await pruneStaleRuntimeMetadata(resolvedDir, SERVICES);

  let stopped = 0;
  let failed = 0;

  const openclawRuntime = await readLiveRuntimeMetadata(resolvedDir, 'openclaw');
  if (openclawRuntime?.pid) {
    try {
      await killProcess(openclawRuntime.pid);
      removeRuntimeMetadata(resolvedDir, 'openclaw');
      console.log(`  ${chalk.green('✓')} OpenClaw stopped ${chalk.gray(`(PID ${openclawRuntime.pid})`)}`);
      stopped++;
    } catch (err) {
      console.log(`  ${chalk.red('✗')} Failed to stop OpenClaw: ${err.message}`);
      failed++;
    }
  } else {
    console.log(`  ${chalk.gray('○')} OpenClaw: not running`);
  }

  const hermesRuntime = await readLiveRuntimeMetadata(resolvedDir, 'hermes');
  if (hermesRuntime?.pid) {
    try {
      await killProcess(hermesRuntime.pid);
      removeRuntimeMetadata(resolvedDir, 'hermes');
      console.log(`  ${chalk.green('✓')} Hermes Agent stopped ${chalk.gray(`(PID ${hermesRuntime.pid})`)}`);
      stopped++;
    } catch (err) {
      console.log(`  ${chalk.red('✗')} Failed to stop Hermes: ${err.message}`);
      failed++;
    }
  } else {
    console.log(`  ${chalk.gray('○')} Hermes Agent: not running`);
  }

  const otherPid = await findProcessByPort(port);
  if (otherPid) {
    if (opts.force) {
      try {
        await killProcess(otherPid);
        console.log(`  ${chalk.green('✓')} Freed port ${port} ${chalk.gray(`(PID ${otherPid})`)}`);
        stopped++;
      } catch (err) {
        console.log(`  ${chalk.red('✗')} Failed to free port ${port}: ${err.message}`);
        failed++;
      }
    } else {
      console.log(`  ${chalk.yellow('!')} Port ${port} is still in use by PID ${otherPid}`);
    }
  }

  console.log('');
  if (failed === 0 && stopped === 0) {
    console.log(`  ${chalk.gray('No services were running.')}`);
  } else if (failed === 0) {
    console.log(`  ${chalk.green('All services stopped.')}`);
  } else {
    console.log(`  ${chalk.yellow(`Stopped: ${stopped}, Failed: ${failed}`)}`);
  }
  console.log('');
}

module.exports = { register, runStop };
