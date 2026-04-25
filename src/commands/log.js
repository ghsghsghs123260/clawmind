/**
 * log command - View recent log entries
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');

function register(program, context) {
  program
    .command('log')
    .description('View recent log entries')
    .option('--lines <n>', 'Number of lines to show', '50')
    .option('--level <level>', 'Filter by level: error, warn, info, debug', 'info')
    .option('--service <service>', 'Filter by service: hermes, openclaw, all', 'all')
    .action(async (opts) => {
      await runLog(context.CLAWMIND_DIR, opts);
    });
}

async function runLog(dataDir, opts) {
  const logDir = path.join(dataDir || path.join(os.homedir(), 'ClawMind'), 'logs');
  const logFile = path.join(logDir, 'clawmind.log');

  if (!fs.existsSync(logFile)) {
    console.log('');
    console.log(`  ${chalk.gray('No log file found at:')} ${logFile}`);
    console.log(`  ${chalk.gray('Run "clawmind start" first to generate logs.')}`);
    console.log('');
    return;
  }

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    const levelFilter = opts.level?.toLowerCase() || 'info';
    const serviceFilter = opts.service?.toLowerCase() || 'all';
    const maxLines = parseInt(opts.lines, 10) || 50;

    const filtered = lines
      .filter(line => {
        if (levelFilter === 'all') return true;
        const l = line.toLowerCase();
        if (levelFilter === 'error') return l.includes('[error]');
        if (levelFilter === 'warn') return l.includes('[warn]') || l.includes('[error]');
        if (levelFilter === 'info') return l.includes('[info]') || l.includes('[warn]') || l.includes('[error]');
        if (levelFilter === 'debug') return true;
        return true;
      })
      .filter(line => {
        if (serviceFilter === 'all') return true;
        return line.toLowerCase().includes(serviceFilter);
      })
      .slice(-maxLines);

    if (filtered.length === 0) {
      console.log(`  ${chalk.gray('No log entries match the filter.')}`);
      return;
    }

    console.log('');
    console.log(`  ${chalk.bold('Recent Logs')} ${chalk.gray(`(${filtered.length} entries)`)}`);
    console.log(`  ${'─'.repeat(60)}`);

    for (const line of filtered) {
      let color = chalk.white;
      const l = line.toLowerCase();
      if (l.includes('[error]')) color = chalk.red;
      else if (l.includes('[warn]')) color = chalk.yellow;
      else if (l.includes('[info]')) color = chalk.green;
      else if (l.includes('[debug]')) color = chalk.gray;

      console.log(`  ${color(line)}`);
    }
    console.log('');
  } catch (err) {
    console.log(`  ${chalk.red('Error reading log file:')} ${err.message}`);
  }
}

module.exports = { register };
