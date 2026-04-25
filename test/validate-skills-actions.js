/**
 * 验证所有 Skills 的 actions 是否在 OpenClaw 中实现
 */

const SkillManager = require('../skills/manager');
const fs = require('fs');
const path = require('path');

// OpenClaw 支持的所有 actions
const SUPPORTED_ACTIONS = [
  // File operations
  'file.read', 'file.write', 'file.delete', 'file.list', 'file.search',
  'file.copy', 'file.move', 'file.info',

  // Terminal operations
  'terminal.exec', 'terminal.exec_script', 'terminal.get_cwd',
  'terminal.set_cwd', 'terminal.get_env', 'terminal.set_env',

  // Browser operations
  'browser.launch', 'browser.close', 'browser.open', 'browser.click',
  'browser.input', 'browser.extract', 'browser.screenshot',
  'browser.wait_for', 'browser.evaluate', 'browser.navigate',

  // Desktop operations
  'desktop.screenshot', 'desktop.capture_screen',

  // Clipboard operations
  'clipboard.read', 'clipboard.write', 'clipboard.clear',

  // Memory operations
  'memory.save_conversation', 'memory.load_conversation', 'memory.list_conversations',
  'memory.save_preference', 'memory.get_preference', 'memory.save_task', 'memory.list_tasks',

  // Notification operations
  'notification.send', 'notification.task_complete', 'notification.error',
];

const actionExecutor = async (actionName, params) => {
  return { success: true };
};

const skillManager = new SkillManager(actionExecutor);

async function main() {
  console.log('Validating Skills actions...\n');

  await skillManager.loadAll();

  const skills = skillManager.listSkills();
  let hasErrors = false;

  skills.forEach(skill => {
    console.log(`\n📋 Skill: ${skill.name}`);
    console.log(`   Description: ${skill.description}`);
    console.log(`   Actions:`);

    skill.actions.forEach((action, index) => {
      const actionName = action.action;
      const isSupported = SUPPORTED_ACTIONS.includes(actionName);

      if (isSupported) {
        console.log(`   ✅ Step ${action.step}: ${actionName}`);
      } else {
        console.log(`   ❌ Step ${action.step}: ${actionName} (NOT SUPPORTED)`);
        hasErrors = true;
      }
    });
  });

  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.log('❌ Some actions are not supported by OpenClaw');
    process.exit(1);
  } else {
    console.log('✅ All actions are supported by OpenClaw');
  }
}

main();
