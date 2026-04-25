/**
 * help command - Display CLI help
 */

const chalk = require('chalk');

function register(program, context) {
  program
    .command('help')
    .description('Display this help message')
    .action(() => {
      printHelp();
    });
}

function printHelp() {
  const lines = [
    '',
    `  ${chalk.cyan('ClawMind')} ${chalk.gray('v5.0.0')} — AI Agent System (OpenClaw + Hermes Agent)`,
    '',
    `  ${chalk.bold('Usage:')}`,
    '    clawmind <command> [options]',
    '',
    `  ${chalk.bold('Commands:')}`,
    '    help         Show this help message',
    '    status       Check if Hermes and OpenClaw are running',
    '    start        Start the ClawMind services (Hermes + OpenClaw)',
    '    stop         Stop all ClawMind services',
    '    restart      Restart all ClawMind services',
    '    doctor       Run diagnostics and auto-fix issues',
    '    config       Show current configuration',
    '    log          View recent log entries',
    '',
    `  ${chalk.bold('Options:')}`,
    '    --dir <path>    ClawMind data directory',
    '    --help          Show help',
    '    --version       Show version',
    '',
    `  ${chalk.bold('Examples:')}`,
    '    clawmind status',
    '    clawmind start',
    '    clawmind doctor --fix',
    '',
  ];

  console.log(lines.join('\n'));
}

module.exports = { register, printHelp };
