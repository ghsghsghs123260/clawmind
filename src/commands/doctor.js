/**
 * doctor command - Run diagnostics and auto-fix issues
 *
 * Checks:
 * - Python environment (version, path)
 * - Node.js environment (version, path)
 * - API Key config validation
 * - Port 8765 availability
 * - Data directory permissions
 * - Config file validity
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  execPromise,
  findProcessByPort,
  checkPortAvailable,
  IS_WINDOWS,
} = require('../utils/process');
const { loadConfig, saveConfig, validateApiKey, validateConfig, ensureDataDir, getDefaultDataDir } = require('../utils/config');
const logger = require('../utils/logger');

const WEBSOCKET_PORT = 8765;

function register(program, context) {
  program
    .command('doctor')
    .description('Run diagnostics and auto-fix issues')
    .option('--fix', 'Attempt to auto-fix detected issues')
    .option('--json', 'Output results as JSON')
    .action(async (opts) => {
      await runDoctor(context.CLAWMIND_DIR, opts);
    });
}

async function runDoctor(dataDir, opts = {}) {
  const autoFix = opts.fix || false;
  const results = [];

  console.log('');
  console.log(`  ${chalk.cyan('ClawMind Doctor')} ${chalk.gray('v5.0.0')} — Diagnostics`);
  if (autoFix) {
    console.log(`  ${chalk.yellow('!')} Auto-fix mode enabled`);
  }
  console.log(`  ${'─'.repeat(50)}`);
  console.log('');

  // ── 1. Python Environment ──────────────────────────────────
  const pythonResult = await checkPython(autoFix);
  results.push(pythonResult);
  printCheckResult(pythonResult, autoFix);

  // ── 2. Node.js Environment ───────────────────────────────
  const nodeResult = await checkNodeJS(autoFix);
  results.push(nodeResult);
  printCheckResult(nodeResult, autoFix);

  // ── 3. Port 8765 Availability ────────────────────────────
  const portResult = await checkPort(dataDir, autoFix);
  results.push(portResult);
  printCheckResult(portResult, autoFix);

  // ── 4. Data Directory ────────────────────────────────────
  const dataDirResult = await checkDataDir(dataDir, autoFix);
  results.push(dataDirResult);
  printCheckResult(dataDirResult, autoFix);

  // ── 5. Config File ──────────────────────────────────────
  const configResult = await checkConfigFile(dataDir, autoFix);
  results.push(configResult);
  printCheckResult(configResult, autoFix);

  // ── 6. API Key ───────────────────────────────────────────
  const apiKeyResult = await checkApiKey(dataDir, autoFix);
  results.push(apiKeyResult);
  printCheckResult(apiKeyResult, autoFix);

  // ── 7. Disk Space ───────────────────────────────────────
  const diskResult = await checkDiskSpace(dataDir, autoFix);
  results.push(diskResult);
  printCheckResult(diskResult, autoFix);

  // ── 8. Hermes & OpenClaw Processes ───────────────────────
  const procResult = await checkProcesses(autoFix);
  results.push(procResult);
  printCheckResult(procResult, autoFix);

  // Summary
  console.log('');
  console.log(`  ${'─'.repeat(50)}`);

  const fixed = results.filter(r => r.fixed).length;
  const failed = results.filter(r => !r.ok && !r.fixed).length;
  const warnings = results.filter(r => r.ok && r.warnings && r.warnings.length > 0).length;

  if (opts.json) {
    console.log(JSON.stringify({ results, summary: { total: results.length, fixed, failed, warnings } }, null, 2));
    return;
  }

  console.log(`  ${chalk.bold('Summary:')}`);
  if (fixed > 0) {
    console.log(`  ${chalk.green('✓')} ${fixed} issue(s) auto-fixed`);
  }
  if (warnings > 0) {
    console.log(`  ${chalk.yellow('!')} ${warnings} warning(s)`);
  }
  if (failed > 0) {
    console.log(`  ${chalk.red('✗')} ${failed} issue(s) need manual attention`);
  }
  if (fixed === 0 && failed === 0 && warnings === 0) {
    console.log(`  ${chalk.green('✓')} All checks passed!`);
  }

  console.log('');
}

function printCheckResult(result, autoFix) {
  const icon = result.fixed
    ? `${chalk.green('✓')} (fixed)`
    : result.ok
    ? chalk.green('✓')
    : chalk.red('✗');
  console.log(`  ${icon} ${chalk.bold(result.label)}`);
  if (result.message) {
    console.log(`    ${result.message}`);
  }
  if (result.warnings && result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(`    ${chalk.yellow('!')} ${w}`);
    }
  }
  if (!result.ok && !result.fixed && result.suggestion) {
    console.log(`    ${chalk.cyan('→')} ${result.suggestion}`);
  }
}

// ── Individual Check Functions ──────────────────────────────────

async function checkPython(autoFix) {
  const result = { label: 'Python Environment', ok: false, warnings: [], fixed: false };

  try {
    const output = await execPromise('python --version 2>&1');
    const match = output.match(/Python\s+(\d+\.\d+\.\d+)/);
    if (match) {
      result.ok = true;
      result.message = `Version ${chalk.cyan(match[1])} — ${chalk.gray('found in PATH')}`;
      const [, major, minor] = match[1].split('.').map(Number);
      if (major < 3 || (major === 3 && minor < 8)) {
        result.warnings.push('Python 3.8+ recommended (some packages may require 3.10+)');
      }
    } else {
      result.message = output;
    }
  } catch (err) {
    result.message = `${chalk.red('Not found in PATH')}`;
    result.suggestion = 'Install Python 3.8+ and add it to your PATH environment variable';
    if (autoFix) {
      // Can't auto-fix Python installation on Windows easily
      result.suggestion += '\n    Download from: https://www.python.org/downloads/';
    }
  }

  return result;
}

async function checkNodeJS(autoFix) {
  const result = { label: 'Node.js Environment', ok: false, warnings: [], fixed: false };

  try {
    const [versionOutput, npmVersion] = await Promise.all([
      execPromise('node --version 2>&1'),
      execPromise('npm --version 2>&1'),
    ]);
    const match = versionOutput.match(/v(\d+\.\d+\.\d+)/);
    if (match) {
      result.ok = true;
      result.message = `Version ${chalk.cyan(match[1])} (npm ${chalk.gray(npmVersion)}) — ${chalk.gray('found in PATH')}`;
      const major = parseInt(match[1].split('.')[0], 10);
      if (major < 18) {
        result.warnings.push('Node.js 18+ recommended for best OpenClaw compatibility');
      }
    } else {
      result.message = versionOutput;
    }
  } catch (err) {
    result.message = `${chalk.red('Not found in PATH')}`;
    result.suggestion = 'Install Node.js 18+ from https://nodejs.org/';
  }

  return result;
}

async function checkPort(dataDir, autoFix) {
  const result = { label: `Port ${WEBSOCKET_PORT} Availability`, ok: false, warnings: [], fixed: false };

  const portFree = await checkPortAvailable(WEBSOCKET_PORT);
  const pid = await findProcessByPort(WEBSOCKET_PORT);

  if (portFree) {
    result.ok = true;
    result.message = `Port ${WEBSOCKET_PORT} is available`;
  } else {
    result.message = `Port ${WEBSOCKET_PORT} is in use ${chalk.gray(`(PID: ${pid || '?'})`)}`;
    result.suggestion = `Stop the process using port ${WEBSOCKET_PORT}, or change the port in config`;

    if (autoFix && pid) {
      try {
        const { killProcess } = require('../utils/process');
        await killProcess(pid);
        result.fixed = true;
        result.message = `Port ${WEBSOCKET_PORT} freed (killed PID ${pid})`;
      } catch (err) {
        result.message += `: ${err.message}`;
      }
    }
  }

  return result;
}

async function checkDataDir(dataDir, autoFix) {
  const result = { label: 'Data Directory', ok: false, warnings: [], fixed: false };

  const resolvedDir = dataDir || getDefaultDataDir();

  // Check if directory exists
  if (!fs.existsSync(resolvedDir)) {
    result.message = `Directory does not exist: ${chalk.cyan(resolvedDir)}`;

    if (autoFix) {
      try {
        ensureDataDir(resolvedDir);
        result.fixed = true;
        result.ok = true;
        result.message = `Created directory: ${chalk.cyan(resolvedDir)}`;
      } catch (err) {
        result.message = `Cannot create directory: ${err.message}`;
        result.suggestion = `Manually create the directory or check permissions`;
      }
    } else {
      result.suggestion = `Run with --fix to create the directory automatically`;
    }
    return result;
  }

  // Check if writable
  try {
    fs.accessSync(resolvedDir, fs.constants.W_OK);
    result.ok = true;
    result.message = `${chalk.cyan(resolvedDir)} ${chalk.gray('(read/write)')}`;

    // Check for key subdirectories
    const subdirs = ['hermes', 'openclaw', 'logs'];
    for (const subdir of subdirs) {
      const subdirPath = path.join(resolvedDir, subdir);
      if (!fs.existsSync(subdirPath)) {
        if (autoFix) {
          fs.mkdirSync(subdirPath, { recursive: true });
          result.warnings.push(`Created missing subdirectory: ${subdir}`);
        } else {
          result.warnings.push(`Missing subdirectory: ${subdir} (will be created on first run)`);
        }
      }
    }
  } catch {
    result.message = `${chalk.red('Permission denied')} — ${resolvedDir}`;
    result.suggestion = 'Grant read/write permissions to the ClawMind directory';
  }

  return result;
}

async function checkConfigFile(dataDir, autoFix) {
  const result = { label: 'Config File', ok: false, warnings: [], fixed: false };

  const resolvedDir = dataDir || getDefaultDataDir();
  const config = loadConfig(resolvedDir);
  const { errors, warnings } = validateConfig(config);

  if (errors.length > 0) {
    result.message = `${errors.length} validation error(s) found`;
    result.warnings = warnings;
    result.suggestion = errors.join('; ');

    if (autoFix) {
      // Try to fix common config issues
      try {
        ensureDataDir(resolvedDir);
        // Reset to defaults for invalid fields
        const fixed = { ...config };
        if (!fixed.websocketPort || fixed.websocketPort < 1024) {
          fixed.websocketPort = 8765;
          result.warnings.push('Reset websocketPort to default (8765)');
        }
        if (!fixed.dataDir) {
          fixed.dataDir = resolvedDir;
        }
        saveConfig(resolvedDir, fixed);
        result.fixed = true;
        result.ok = true;
        result.message = 'Config auto-repaired and saved';
      } catch (err) {
        result.message = `Cannot repair config: ${err.message}`;
      }
    }
  } else if (warnings.length > 0) {
    result.ok = true;
    result.message = 'Config file is valid';
    result.warnings = warnings;
  } else {
    result.ok = true;
    result.message = 'Config file is valid';
  }

  return result;
}

async function checkApiKey(dataDir, autoFix) {
  const result = { label: 'API Key', ok: false, warnings: [], fixed: false };

  const resolvedDir = dataDir || getDefaultDataDir();
  const config = loadConfig(resolvedDir);

  const validation = validateApiKey(config.apiKey || '');
  if (validation.valid) {
    result.ok = true;
    const masked = validation.key.slice(0, 6) + '***' + validation.key.slice(-4);
    result.message = `Configured ${chalk.gray(`(${masked})`)}`;
  } else {
    result.message = 'Not configured or invalid';
    result.suggestion = 'Edit the config.json file and add your API key';

    if (autoFix) {
      // Prompt would be needed for interactive, so just show instructions
      result.suggestion = `Set your API key by running: clawmind config --set-api-key <KEY>`;
    }
  }

  return result;
}

async function checkDiskSpace(dataDir, autoFix) {
  const result = { label: 'Disk Space', ok: false, warnings: [], fixed: false };

  try {
    // Use wmic on Windows to get disk space
    let output;
    if (IS_WINDOWS) {
      output = await execPromise('wmic logicaldisk get size,freespace,caption /format:csv');
    } else {
      output = await execPromise('df -k .');
    }

    // Parse free space (rough)
    const lines = output.split('\n').filter(l => l.trim());
    let freeMB = 0;

    if (IS_WINDOWS) {
      // WMIC CSV format:
      // Node,Caption,FreeSpace,Size (header - single line with commas)
      // then one data line per disk: ,C:,367130599424,511777435648
      // Skip header row (first line that starts with 'Node')
      const dataLines = lines.filter(l => !l.trim().startsWith('Node'));
      for (const line of dataLines) {
        const parts = line.split(',');
        // Format: [empty],Caption,FreeSpace,Size
        if (parts.length >= 3) {
          const free = parseInt(parts[2], 10); // FreeSpace is at index 2
          if (!isNaN(free) && free > 0) {
            freeMB = Math.max(freeMB, Math.round(free / 1024 / 1024));
          }
        }
      }
    } else {
      // Linux df output
      const lastLine = lines[lines.length - 1];
      const parts = lastLine.trim().split(/\s+/);
      if (parts.length >= 4) {
        freeMB = Math.round(parseInt(parts[3], 10) / 1024);
      }
    }
    if (freeMB < 100) {
      // Very low - likely parsing error, try PowerShell as fallback
      try {
        const psOut = await execPromise('powershell -Command "(Get-PSDrive C).Free / 1MB"');
        const psMB = parseInt(psOut, 10);
        if (!isNaN(psMB) && psMB > 100) {
          freeMB = psMB;
        }
      } catch {
        // Keep original value
      }
    }

    if (freeMB > 1024) {
      result.ok = true;
      result.message = `${Math.round(freeMB / 1024)} GB free`;
      if (freeMB < 5 * 1024) {
        result.warnings.push('Less than 5GB free — consider freeing up space');
      }
    } else if (freeMB > 100) {
      result.ok = true;
      result.message = `${freeMB} MB free`;
      result.warnings.push('Low disk space — ensure sufficient free space for AI model caching');
    } else {
      result.message = `${freeMB} MB free`;
      result.warnings.push('Very low disk space — this may cause issues');
    }
  } catch (err) {
    result.ok = true;
    result.message = 'Could not determine disk space';
    result.warnings = [err.message];
  }

  return result;
}

async function checkProcesses(autoFix) {
  const result = { label: 'ClawMind Processes', ok: true, warnings: [], fixed: false };

  const { findProcessByName, findProcessByPort } = require('../utils/process');

  const hermesByPort = await findProcessByPort(WEBSOCKET_PORT);
  const hermesByName = await findProcessByName('hermes-agent');
  const openclawByName = await findProcessByName('openclaw');

  const hermesRunning = hermesByPort || hermesByName;
  const openclawRunning = openclawByName;

  if (!hermesRunning && !openclawRunning) {
    result.warnings.push('No ClawMind services are currently running');
    result.message = 'Use clawmind start to start services';
  } else {
    const running = [];
    if (hermesRunning) {
      const pid = hermesByPort || hermesByName?.pid;
      running.push(`Hermes (PID ${pid})`);
    }
    if (openclawRunning) {
      running.push(`OpenClaw (PID ${openclawRunning.pid})`);
    }
    result.message = running.join(', ') + ' running';
  }

  return result;
}

module.exports = { register, runDoctor };
