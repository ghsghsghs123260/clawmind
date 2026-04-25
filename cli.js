#!/usr/bin/env node
/**
 * ClawMind CLI Entry Point
 * Coordinates Hermes Agent (brain) and OpenClaw (hands)
 */

const { Command } = require('commander');
const path = require('path');
const os = require('os');

const CLI_DIR = __dirname;
const PROJECT_ROOT = CLI_DIR;

// Determine ClawMind data directory
function getClawMindDir() {
  // Allow override via environment variable
  if (process.env.CLAWMIND_DIR) {
    return process.env.CLAWMIND_DIR;
  }
  return path.join(os.homedir(), 'ClawMind');
}

const CLAWMIND_DIR = getClawMindDir();

const program = new Command();

program
  .name('clawmind')
  .description('ClawMind AI Agent System - OpenClaw + Hermes Agent')
  .version('5.0.0')
  .option('--dir <path>', 'ClawMind data directory', CLAWMIND_DIR)
  .configureOutput({
    writeErr: (str) => console.error(str.trimEnd()),
  });

// Dynamically load commands
const commands = ['help', 'status', 'start', 'stop', 'restart', 'doctor', 'config', 'log', 'skill'];

for (const cmd of commands) {
  try {
    const cmdPath = path.join(CLI_DIR, 'src', 'commands', `${cmd}.js`);
    // Require with cache clear to allow live reload
    delete require.cache[require.resolve(cmdPath)];
    const cmdModule = require(cmdPath);
    if (cmdModule.register) {
      cmdModule.register(program, { CLAWMIND_DIR, PROJECT_ROOT });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ClawMind] Failed to load command '${cmd}': ${err.message}`);
    }
  }
}

// Default: show help if no command given
if (process.argv.length === 2) {
  process.argv.push('--help');
}

program.parse(process.argv);
