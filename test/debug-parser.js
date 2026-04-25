/**
 * 调试 Skill 解析
 */

const { loadSkillFromFile } = require('../skills/parser');
const path = require('path');

const skillPath = path.join(__dirname, '../skills/builtin/search_web.md');

console.log('Parsing:', skillPath);
console.log('');

const skill = loadSkillFromFile(skillPath);

console.log('Parsed Skill:');
console.log(JSON.stringify(skill, null, 2));
