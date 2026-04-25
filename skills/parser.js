/**
 * Skill Parser
 * 解析 SKILL.md 格式的技能定义文件
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 Skill Markdown 文件
 * @param {string} mdContent - Markdown 内容
 * @returns {Object} 解析后的 Skill 对象
 */
function parseSkillMarkdown(mdContent) {
  const skill = {
    name: '',
    description: '',
    trigger: {
      keywords: [],
      patterns: [],
    },
    parameters: [],
    actions: [],
    examples: [],
  };

  // 按行分割
  const lines = mdContent.split('\n');
  let currentSection = null;
  let currentAction = null;
  let currentExample = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过空行
    if (!line) continue;

    // 解析标题
    if (line.startsWith('# ')) {
      skill.name = line.substring(2).trim();
      continue;
    }

    // 解析二级标题（章节）
    if (line.startsWith('## ')) {
      currentSection = line.substring(3).trim().toLowerCase();
      currentAction = null;
      currentExample = null;
      continue;
    }

    // 根据当前章节解析内容
    switch (currentSection) {
      case 'description':
      case '描述':
        skill.description += line + ' ';
        break;

      case 'trigger':
      case '触发条件':
        // 匹配 "- **Keywords:** value" 格式
        const keywordsMatch = line.match(/^-\s+\*\*Keywords:\*\*\s+(.+)$/i) ||
                             line.match(/^-\s+\*\*关键词:\*\*\s+(.+)$/);
        if (keywordsMatch) {
          const keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k);
          skill.trigger.keywords.push(...keywords);
        }

        // 匹配 "- **Pattern:** value" 格式
        const patternMatch = line.match(/^-\s+\*\*Pattern:\*\*\s+(.+)$/i) ||
                            line.match(/^-\s+\*\*模式:\*\*\s+(.+)$/);
        if (patternMatch) {
          const pattern = patternMatch[1].replace(/^`|`$/g, '').trim();
          if (pattern) {
            skill.trigger.patterns.push(pattern);
          }
        }
        break;

      case 'parameters':
      case '参数':
        if (line.startsWith('- **')) {
          const match = line.match(/- \*\*(.+?)\*\*\s*\((.+?)\):\s*(.+)/);
          if (match) {
            skill.parameters.push({
              name: match[1].trim(),
              type: match[2].trim(),
              description: match[3].trim(),
              required: !line.includes('optional') && !line.includes('可选'),
            });
          }
        }
        break;

      case 'actions':
      case '动作':
        if (line.startsWith('### ')) {
          // 新的动作
          currentAction = {
            step: parseInt(line.match(/\d+/)?.[0] || '0'),
            action: '',
            params: {},
          };
          skill.actions.push(currentAction);
        } else if (currentAction) {
          // 匹配 "- **Action:** value" 格式
          const actionMatch = line.match(/^-\s+\*\*Action:\*\*\s+(.+)$/i) ||
                             line.match(/^-\s+\*\*动作:\*\*\s+(.+)$/);
          if (actionMatch) {
            currentAction.action = actionMatch[1].trim();
          } else {
            // 匹配参数 "- **key:** value" 格式
            const paramMatch = line.match(/^-\s+\*\*(.+?):\*\*\s+(.+)$/);
            if (paramMatch) {
              const paramName = paramMatch[1].trim();
              let paramValue = paramMatch[2].trim();

              // 移除反引号
              if (paramValue.startsWith('`') && paramValue.endsWith('`')) {
                paramValue = paramValue.slice(1, -1);
              }

              currentAction.params[paramName] = paramValue;
            }
          }
        }
        break;

      case 'examples':
      case '示例':
        if (line.startsWith('### ')) {
          currentExample = {
            title: line.substring(4).trim(),
            input: '',
            output: '',
          };
          skill.examples.push(currentExample);
        } else if (currentExample) {
          if (line.startsWith('**Input:**') || line.startsWith('**输入:**')) {
            currentExample.input = line.split(':')[1].trim();
          } else if (line.startsWith('**Output:**') || line.startsWith('**输出:**')) {
            currentExample.output = line.split(':')[1].trim();
          }
        }
        break;
    }
  }

  // 清理描述
  skill.description = skill.description.trim();

  return skill;
}

/**
 * 解析 JSON 格式的 Skill 文件
 * @param {string} jsonContent - JSON 内容
 * @returns {Object} 解析后的 Skill 对象
 */
function parseSkillJSON(jsonContent) {
  const skill = JSON.parse(jsonContent);

  // 标准化格式
  if (!skill.trigger) {
    skill.trigger = { keywords: [], patterns: [] };
  }
  if (!skill.parameters) {
    skill.parameters = [];
  }
  if (!skill.actions) {
    skill.actions = [];
  }
  if (!skill.examples) {
    skill.examples = [];
  }

  return skill;
}

/**
 * 从文件加载 Skill
 * @param {string} filePath - 文件路径
 * @returns {Object} 解析后的 Skill 对象
 */
function loadSkillFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.md') {
    return parseSkillMarkdown(content);
  } else if (ext === '.json') {
    return parseSkillJSON(content);
  } else {
    throw new Error(`Unsupported skill file format: ${ext}`);
  }
}

/**
 * 验证 Skill 对象
 * @param {Object} skill - Skill 对象
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateSkill(skill) {
  const errors = [];

  if (!skill.name) {
    errors.push('Skill name is required');
  }

  if (!skill.description) {
    errors.push('Skill description is required');
  }

  if (!skill.trigger || !skill.trigger.keywords || (skill.trigger.keywords.length === 0 && (!skill.trigger.patterns || skill.trigger.patterns.length === 0))) {
    errors.push('Skill must have at least one trigger (keyword or pattern)');
  }

  if (!skill.actions || skill.actions.length === 0) {
    errors.push('Skill must have at least one action');
  } else {
    // 验证每个动作
    skill.actions.forEach((action, index) => {
      if (!action.action) {
        errors.push(`Action ${index + 1} is missing action name`);
      }
    });
  }

  // 验证必需参数
  (skill.parameters || []).forEach((param) => {
    if (param.required && !param.name) {
      errors.push(`Required parameter is missing name`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 将 Skill 对象转换为 JSON
 * @param {Object} skill - Skill 对象
 * @returns {string} JSON 字符串
 */
function skillToJSON(skill) {
  return JSON.stringify(skill, null, 2);
}

/**
 * 将 Skill 对象转换为 Markdown
 * @param {Object} skill - Skill 对象
 * @returns {string} Markdown 字符串
 */
function skillToMarkdown(skill) {
  let md = `# ${skill.name}\n\n`;
  md += `## Description\n\n${skill.description}\n\n`;

  // Trigger
  md += `## Trigger\n\n`;
  if (skill.trigger.keywords.length > 0) {
    md += `- **Keywords:** ${skill.trigger.keywords.join(', ')}\n`;
  }
  if (skill.trigger.patterns.length > 0) {
    skill.trigger.patterns.forEach(pattern => {
      md += `- **Pattern:** ${pattern}\n`;
    });
  }
  md += '\n';

  // Parameters
  if (skill.parameters.length > 0) {
    md += `## Parameters\n\n`;
    skill.parameters.forEach(param => {
      const required = param.required ? 'required' : 'optional';
      md += `- **${param.name}** (${param.type}, ${required}): ${param.description}\n`;
    });
    md += '\n';
  }

  // Actions
  md += `## Actions\n\n`;
  skill.actions.forEach((action, index) => {
    md += `### Step ${index + 1}\n\n`;
    md += `- **Action:** ${action.action}\n`;
    Object.entries(action.params).forEach(([key, value]) => {
      md += `- **${key}:** \`${value}\`\n`;
    });
    md += '\n';
  });

  // Examples
  if (skill.examples.length > 0) {
    md += `## Examples\n\n`;
    skill.examples.forEach(example => {
      md += `### ${example.title}\n\n`;
      md += `**Input:** ${example.input}\n\n`;
      md += `**Output:** ${example.output}\n\n`;
    });
  }

  return md;
}

module.exports = {
  parseSkillMarkdown,
  parseSkillJSON,
  loadSkillFromFile,
  validateSkill,
  skillToJSON,
  skillToMarkdown,
};
