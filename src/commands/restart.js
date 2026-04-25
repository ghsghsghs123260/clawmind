/**
 * restart command - Restart all ClawMind services
 */

const chalk = require('chalk');
const { runStop } = require('./stop');
const { runStart } = require('./start');

function register(program, context) {
  program
    .command('restart')
    .description('Stop and restart all ClawMind services')
    .option('--skip-health-check', 'Skip pre-start health checks')
    .action(async (opts) => {
      console.log('');
      console.log(`  ${chalk.cyan('ClawMind')} — Restarting services...`);
      console.log('');
      await runStop(context.CLAWMIND_DIR, { force: true });
      console.log(`  ${chalk.cyan('---')}`);
      await new Promise(r => setTimeout(r, 1000));
      await runStart(context.CLAWMIND_DIR, { skipHealthCheck: opts.skipHealthCheck, force: false });
    });
}

module.exports = { register };
