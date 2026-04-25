/**
 * Build script: bundle all dependencies into a single entry file for pkg
 * This avoids pkg's limitation of not being able to resolve ../ paths
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OPENCLAW = __dirname;
const OUT = path.join(OPENCLAW, 'dist');

// Clean
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'modules'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'skills'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'skills', 'builtin'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'memory'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'notifications'), { recursive: true });

function copySync(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      copySync(path.join(src, f), path.join(dest, f));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy openclaw own modules
for (const f of fs.readdirSync(path.join(OPENCLAW, 'modules'))) {
  copySync(path.join(OPENCLAW, 'modules', f), path.join(OUT, 'modules', f));
}

// Copy client.js -> dist/client.js  (with fixed require paths)
let clientSrc = fs.readFileSync(path.join(OPENCLAW, 'client.js'), 'utf-8');
clientSrc = clientSrc
  .replace("require('../memory')", "require('./memory')")
  .replace("require('../skills/adapter')", "require('./skills/adapter')")
  .replace("require('../notifications')", "require('./notifications')");
fs.writeFileSync(path.join(OUT, 'client.js'), clientSrc);

// Copy memory module
copySync(path.join(ROOT, 'memory'), path.join(OUT, 'memory'));

// Copy skills module
const skillsFiles = ['adapter.js', 'manager.js', 'parser.js', 'matcher.js', 'executor.js'];
for (const f of skillsFiles) {
  const src = path.join(ROOT, 'skills', f);
  if (fs.existsSync(src)) copySync(src, path.join(OUT, 'skills', f));
}
// Copy skills/builtin
copySync(path.join(ROOT, 'skills', 'builtin'), path.join(OUT, 'skills', 'builtin'));
// Copy skills/cli.js
const cliSrc = path.join(ROOT, 'skills', 'cli.js');
if (fs.existsSync(cliSrc)) copySync(cliSrc, path.join(OUT, 'skills', 'cli.js'));

// Generate builtin manifest for pkg VFS compatibility
// pkg's virtual filesystem doesn't reliably serve JSON/MD asset files,
// so we embed all skill definitions directly into a JS module.
const builtinDir = path.join(ROOT, 'skills', 'builtin');
const builtinFiles = fs.readdirSync(builtinDir).filter(f => f.endsWith('.json') || f.endsWith('.md'));
console.log('Embedding', builtinFiles.length, 'builtin skills into JS module');

const parser = require(path.join(ROOT, 'skills', 'parser.js'));
const embeddedSkills = [];
for (const file of builtinFiles) {
  try {
    const skill = parser.loadSkillFromFile(path.join(builtinDir, file));
    const validation = parser.validateSkill(skill);
    if (validation.valid) {
      skill.source = 'builtin';
      embeddedSkills.push(skill);
    } else {
      console.warn('  ✗ Invalid skill', file, ':', validation.errors);
    }
  } catch (e) {
    console.warn('  ✗ Failed to parse', file, ':', e.message);
  }
}

// Write embedded_skills.js — a JS module that exports all skills directly
const embeddedCode = `// Auto-generated: embedded builtin skills for pkg compatibility
// This module embeds all skill definitions to avoid pkg VFS issues
const embeddedSkills = ${JSON.stringify(embeddedSkills, null, 2)};
module.exports = embeddedSkills;
`;
fs.writeFileSync(path.join(OUT, 'skills', 'embedded_skills.js'), embeddedCode);

// Patch manager.js: wrap readdirSync in try-catch with manifest fallback for pkg VFS
// Also patch loadAll to bypass existsSync check (pkg VFS may not support it)
let managerSrc = fs.readFileSync(path.join(OUT, 'skills', 'manager.js'), 'utf-8');

// Patch loadAll: replace existsSync check with try-catch + embedded fallback
managerSrc = managerSrc.replace(
  `    if (includeBuiltin && fs.existsSync(this.builtinPath)) {
      await this.loadFromDirectory(this.builtinPath, 'builtin');
    }`,
  `    if (includeBuiltin) {
      try {
        await this.loadFromDirectory(this.builtinPath, 'builtin');
        // If no skills loaded from filesystem (pkg VFS issue), use embedded
        if (this.skills.size === 0) {
          const embedded = require('./embedded_skills');
          for (const skill of embedded) {
            this.skills.set(skill.name, skill);
          }
          if (embedded.length > 0) console.log('Loaded ' + embedded.length + ' embedded skills (pkg fallback)');
        }
      } catch (e) {
        // Directory loading failed (pkg VFS) — try embedded fallback
        try {
          const embedded = require('./embedded_skills');
          for (const skill of embedded) {
            this.skills.set(skill.name, skill);
          }
          if (embedded.length > 0) console.log('Loaded ' + embedded.length + ' embedded skills');
        } catch (e2) {
          console.warn('Failed to load embedded skills:', e2.message);
        }
      }
    }`
);

// Patch loadFromDirectory: wrap readdirSync with try-catch for pkg VFS
// (embedded fallback is handled in loadAll)
const originalLoadFromDir = `  async loadFromDirectory(dirPath, source = 'unknown') {
    const files = fs.readdirSync(dirPath);`;
const patchedLoadFromDir = `  async loadFromDirectory(dirPath, source = 'unknown') {
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch (e) {
      // pkg VFS doesn't support readdirSync — embedded fallback handled in loadAll
      return;
    }`;
managerSrc = managerSrc.replace(originalLoadFromDir, patchedLoadFromDir);

fs.writeFileSync(path.join(OUT, 'skills', 'manager.js'), managerSrc);

// Copy notifications module
copySync(path.join(ROOT, 'notifications'), path.join(OUT, 'notifications'));

// Write package.json for pkg asset resolution
// Explicitly list every file since pkg's glob support is unreliable
const allAssets = [];
function collectAssets(dir, prefix) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      collectAssets(full, prefix + f + '/');
    } else {
      allAssets.push(prefix + f);
    }
  }
}
collectAssets(path.join(OUT, 'modules'), 'modules/');
collectAssets(path.join(OUT, 'memory'), 'memory/');
collectAssets(path.join(OUT, 'skills'), 'skills/');
collectAssets(path.join(OUT, 'notifications'), 'notifications/');
console.log('Explicit assets:', allAssets.length, 'files');

fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify({
  name: 'clawmind-openclaw-dist',
  version: '5.0.0',
  pkg: {
    assets: allAssets,
  },
}, null, 2));

console.log('Bundle created in', OUT);
console.log('Files:');
function listFiles(dir, prefix = '') {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      listFiles(full, prefix + f + '/');
    } else {
      console.log(' ', prefix + f, '(' + Math.round(stat.size / 1024) + 'KB)');
    }
  }
}
listFiles(OUT);
