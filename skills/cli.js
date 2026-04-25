#!/usr/bin/env node
/**
 * Skills CLI
 * 命令行工具，供 Hermes Python 端调用
 */

const SkillManager = require('./manager');

// 创建简单的动作执行器（返回占位符）
const actionExecutor = async (actionName, params) => {
  return {
    success: true,
    action: actionName,
    params: params,
    needsExecution: true,
  };
};

const skillManager = new SkillManager(actionExecutor);

// 禁用 console.log/warn 输出（避免干扰 JSON stdout），保留 console.error
const originalLog = console.log;
const originalWarn = console.warn;
console.log = () => {};
console.warn = () => {};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    // 加载所有 Skills
    await skillManager.loadAll();

    switch (command) {
      case 'match': {
        // 匹配用户输入
        const input = args[1];
        const thresholdIndex = args.indexOf('--threshold');
        const threshold = thresholdIndex !== -1 ? parseFloat(args[thresholdIndex + 1]) : 0.3;

        const match = skillManager.matchInput(input, { threshold });

        if (match) {
          originalLog(JSON.stringify({
            success: true,
            skill: {
              name: match.skill.name,
              description: match.skill.description,
              parameters: match.skill.parameters,
            },
            score: match.matchResult.score,
          }));
        } else {
          originalLog(JSON.stringify({
            success: false,
            error: 'No matching skill found',
          }));
        }
        break;
      }

      case 'execute': {
        // 执行 Skill
        const skillName = args[1];
        const paramsIndex = args.indexOf('--params');
        const params = paramsIndex !== -1 ? JSON.parse(args[paramsIndex + 1]) : {};

        const result = await skillManager.executeSkill(skillName, params);

        originalLog(JSON.stringify(result));
        break;
      }

      case 'list': {
        // 列出所有 Skills
        const skills = skillManager.listSkills();

        originalLog(JSON.stringify({
          success: true,
          count: skills.length,
          skills: skills.map(s => ({
            name: s.name,
            description: s.description,
            source: s.source,
            triggers: s.trigger.keywords,
          })),
        }));
        break;
      }

      case 'get': {
        // 获取单个 Skill
        const skillName = args[1];
        const skill = skillManager.getSkill(skillName);

        if (skill) {
          originalLog(JSON.stringify({
            success: true,
            skill: skill,
          }));
        } else {
          originalLog(JSON.stringify({
            success: false,
            error: `Skill not found: ${skillName}`,
          }));
        }
        break;
      }

      default:
        console.error(JSON.stringify({
          success: false,
          error: `Unknown command: ${command}`,
          usage: 'node cli.js <match|execute|list|get> [args]',
        }));
        process.exit(1);
    }
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }));
    process.exit(1);
  }
}

main();
