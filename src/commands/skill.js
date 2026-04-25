/**
 * skill command - Manage ClawMind skills
 */

const chalk = require('chalk');
const { execSync } = require('child_process');
const path = require('path');

const SKILLS_CLI = path.join(__dirname, '..', '..', 'skills', 'cli.js');

function runSkillsCli(...args) {
  try {
    // 使用数组形式传参，避免空格问题
    const { spawnSync } = require('child_process');
    const result = spawnSync('node', [SKILLS_CLI, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status === 0 && result.stdout.trim()) {
      return JSON.parse(result.stdout.trim());
    }
    return { success: false, error: result.stderr?.trim() || 'Unknown error' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function register(program, context) {
  const skill = program
    .command('skill')
    .description('Manage ClawMind skills');

  skill
    .command('list')
    .description('List all available skills')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const result = runSkillsCli('list');
      if (!result.success) {
        console.log(chalk.red('  Error:'), result.error);
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('');
      console.log(`  ${chalk.bold('ClawMind Skills')} (${result.count} total)`);
      console.log(`  ${'─'.repeat(60)}`);

      const categories = { file: [], web: [], desktop: [], system: [], other: [] };
      for (const s of result.skills) {
        const name = s.name.toLowerCase();
        if (name.startsWith('file_') || name === 'file_search' || name.includes('file')) {
          categories.file.push(s);
        } else if (name.includes('web') || name.includes('scrape') || name === 'search web') {
          categories.web.push(s);
        } else if (name.includes('screenshot') || name.includes('window') || name.includes('desktop')) {
          categories.desktop.push(s);
        } else if (name.includes('system') || name.includes('app') || name.includes('launch')) {
          categories.system.push(s);
        } else {
          categories.other.push(s);
        }
      }

      const printGroup = (label, items) => {
        if (items.length === 0) return;
        console.log(`  ${chalk.cyan(label)}`);
        for (const s of items) {
          console.log(`    ${chalk.green('●')} ${chalk.bold(s.name)}`);
          console.log(`      ${chalk.gray(s.description)}`);
          console.log(`      Triggers: ${chalk.yellow(s.triggers.slice(0, 5).join(', '))}`);
        }
        console.log('');
      };

      printGroup('File Operations', categories.file);
      printGroup('Web & Browser', categories.web);
      printGroup('Desktop Control', categories.desktop);
      printGroup('System & Apps', categories.system);
      printGroup('Other', categories.other);
    });

  skill
    .command('info <name>')
    .description('Show detailed info about a skill')
    .action((skillName) => {
      const result = runSkillsCli('get', skillName);
      if (!result.success) {
        console.log(chalk.red('  Error:'), result.error || `Skill "${skillName}" not found`);
        return;
      }

      const s = result.skill;
      console.log('');
      console.log(`  ${chalk.bold(s.name)}`);
      console.log(`  ${'─'.repeat(50)}`);
      console.log(`  ${chalk.gray('Description:')} ${s.description}`);
      console.log(`  ${chalk.gray('Source:')}      ${s.source || 'builtin'}`);
      if (s.trigger) {
        console.log(`  ${chalk.gray('Keywords:')}    ${(s.trigger.keywords || []).join(', ')}`);
        if (s.trigger.patterns) {
          console.log(`  ${chalk.gray('Patterns:')}    ${s.trigger.patterns.join('\n                ')}`);
        }
      }
      if (s.parameters && s.parameters.length > 0) {
        console.log(`  ${chalk.gray('Parameters:')}`);
        for (const p of s.parameters) {
          const req = p.required ? chalk.red('required') : chalk.gray('optional');
          const def = p.default !== undefined ? ` default=${chalk.yellow(p.default)}` : '';
          console.log(`    ${chalk.green(p.name)} (${p.type}, ${req})${def} - ${p.description || ''}`);
        }
      }
      if (s.actions && s.actions.length > 0) {
        console.log(`  ${chalk.gray('Actions:')}`);
        for (const a of s.actions) {
          const params = a.params ? Object.entries(a.params).map(([k,v]) => `${k}=${v}`).join(', ') : '';
          console.log(`    ${chalk.cyan(`Step ${a.step}:`)} ${chalk.bold(a.action)} ${chalk.gray(params)}`);
        }
      }
      console.log('');
    });

  skill
    .command('match <input>')
    .description('Test which skill matches the given input')
    .action((input) => {
      const result = runSkillsCli('match', input);

      if (!result.success) {
        console.log(chalk.red('  No match found for:'), `"${input}"`);
        console.log(chalk.gray('  Try: clawmind skill list'));
        return;
      }

      console.log('');
      console.log(`  ${chalk.green('✓')} Matched: ${chalk.bold(result.skill.name)}`);
      console.log(`    Score:    ${result.score.toFixed(3)}`);
      console.log(`    Input:    "${input}"`);
      console.log(`    Desc:     ${result.skill.description}`);
      if (result.skill.parameters && result.skill.parameters.length > 0) {
        console.log(`    Params:   ${result.skill.parameters.map(p => p.name).join(', ')}`);
      }
      console.log('');
    });

  skill
    .command('validate <file>')
    .description('Validate a skill definition file')
    .action((filePath) => {
      const { loadSkillFromFile, validateSkill } = require('../../skills/parser');
      const fs = require('fs');
      const resolved = path.resolve(filePath);

      if (!fs.existsSync(resolved)) {
        console.log(chalk.red('  Error:'), `File not found: ${resolved}`);
        return;
      }

      try {
        const skill = loadSkillFromFile(resolved);
        const result = validateSkill(skill);

        if (result.valid) {
          console.log('');
          console.log(`  ${chalk.green('✓')} Valid skill: ${chalk.bold(skill.name)}`);
          console.log(`    File: ${resolved}`);
          console.log(`    Actions: ${skill.actions ? skill.actions.length : 0}`);
          console.log(`    Parameters: ${skill.parameters ? skill.parameters.length : 0}`);
          console.log('');
        } else {
          console.log('');
          console.log(`  ${chalk.red('✗')} Invalid skill: ${skill.name || '(unnamed)'}`);
          for (const err of result.errors) {
            console.log(`    ${chalk.red('•')} ${err}`);
          }
          console.log('');
        }
      } catch (error) {
        console.log(chalk.red('  Error parsing file:'), error.message);
      }
    });

  skill
    .command('remove <name>')
    .description('Remove a custom skill')
    .action((skillName) => {
      const result = runSkillsCli('get', skillName);
      if (!result.success) {
        console.log(chalk.red('  Error:'), `Skill "${skillName}" not found`);
        return;
      }

      const skill = result.skill;
      if (skill.source === 'builtin') {
        console.log(chalk.yellow('  Warning:'), 'Cannot remove builtin skills. Only custom skills can be removed.');
        return;
      }

      const fs = require('fs');
      if (skill.filePath && fs.existsSync(skill.filePath)) {
        fs.unlinkSync(skill.filePath);
        console.log('');
        console.log(`  ${chalk.green('✓')} Removed skill: ${chalk.bold(skillName)}`);
        console.log(`    Deleted: ${skill.filePath}`);
        console.log('');
      } else {
        console.log(chalk.red('  Error:'), `Skill file not found: ${skill.filePath}`);
      }
    });
}

module.exports = { register };
