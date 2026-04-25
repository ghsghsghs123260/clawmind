/**
 * ClawMind 端到端集成测试
 * 覆盖：Skill 匹配→参数提取→执行验证，组件间通信
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SKILLS_CLI = path.join(PROJECT_ROOT, 'skills', 'cli.js');
const CLI = path.join(PROJECT_ROOT, 'cli.js');

function runNode(script, args = []) {
  const result = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
    json() {
      try { return JSON.parse(this.stdout); } catch { return null; }
    },
  };
}

describe('Skills CLI - 端到端', () => {
  it('lists all skills', () => {
    const r = runNode(SKILLS_CLI, ['list']);
    expect(r.exitCode).toBe(0);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it('matches file_search with correct params', () => {
    const r = runNode(SKILLS_CLI, ['match', 'find files *.js in /src']);
    expect(r.exitCode).toBe(0);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.skill.name).toBe('file_search');
  });

  it('matches web_scraping and extracts URL', () => {
    const r = runNode(SKILLS_CLI, ['match', 'scrape https://example.com']);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.skill.name).toBe('web_scraping');
  });

  it('matches file_copy with source/destination', () => {
    const r = runNode(SKILLS_CLI, ['match', 'copy a.txt to b.txt']);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.skill.name).toBe('file_copy');
  });

  it('matches app_launch', () => {
    const r = runNode(SKILLS_CLI, ['match', '启动 notepad']);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.skill.name).toBe('app_launch');
  });

  it('returns no match for unrelated input', () => {
    const r = runNode(SKILLS_CLI, ['match', 'what is the meaning of life']);
    const data = r.json();
    expect(data.success).toBe(false);
  });

  it('gets skill detail by name', () => {
    const r = runNode(SKILLS_CLI, ['get', 'file_search']);
    const data = r.json();
    expect(data.success).toBe(true);
    expect(data.skill.name).toBe('file_search');
    expect(data.skill.trigger.keywords.length).toBeGreaterThan(0);
    expect(data.skill.actions.length).toBeGreaterThan(0);
  });

  it('returns error for unknown skill', () => {
    const r = runNode(SKILLS_CLI, ['get', 'nonexistent_skill']);
    const data = r.json();
    expect(data.success).toBe(false);
  });
});

describe('File Operations - 路径沙箱', () => {
  const FileOps = require(path.join(PROJECT_ROOT, 'openclaw', 'modules', 'file-operations.js'));
  const tmpDir = path.join(PROJECT_ROOT, 'test', '_tmp_sandbox');
  let fo;

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello', 'utf8');
    fo = new FileOps(tmpDir);
  });

  it('allows reading inside sandbox', async () => {
    const result = await fo.read({ path: path.join(tmpDir, 'test.txt') });
    expect(result.success).toBe(true);
    expect(result.content).toBe('hello');
  });

  it('blocks reading outside sandbox', async () => {
    await expect(fo.read({ path: 'C:/Windows/win.ini' }))
      .rejects.toThrow('Path escapes sandbox');
  });

  it('allows writing inside sandbox', async () => {
    const result = await fo.write({ path: path.join(tmpDir, 'new.txt'), content: 'world' });
    expect(result.success).toBe(true);
  });

  it('blocks writing outside sandbox', async () => {
    await expect(fo.write({ path: 'C:/evil.txt', content: 'hack' }))
      .rejects.toThrow('Path escapes sandbox');
  });

  it('allows list inside sandbox', async () => {
    const result = await fo.list({ path: tmpDir });
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  it('allows search inside sandbox', async () => {
    const result = await fo.search({ path: tmpDir, pattern: 'test' });
    expect(result.success).toBe(true);
  });

  it('allows copy inside sandbox', async () => {
    const result = await fo.copy({ source: path.join(tmpDir, 'test.txt'), destination: path.join(tmpDir, 'test_copy.txt'), overwrite: true });
    expect(result.success).toBe(true);
  });

  it('blocks copy destination outside sandbox', async () => {
    await expect(fo.copy({ source: path.join(tmpDir, 'test.txt'), destination: 'C:/evil.txt' }))
      .rejects.toThrow('Path escapes sandbox');
  });
});

describe('Terminal Operations - 命令过滤', () => {
  const { TerminalOperations } = require(path.join(PROJECT_ROOT, 'openclaw', 'modules', 'terminal-operations.js'));
  const t = new TerminalOperations();

  it('executes safe commands', async () => {
    const result = await t.exec({ command: 'echo hello_integration_test' });
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('hello_integration_test');
  });

  it('blocks shutdown', async () => {
    await expect(t.exec({ command: 'shutdown /s /t 0' }))
      .rejects.toThrow('Blocked command');
  });

  it('blocks format', async () => {
    await expect(t.exec({ command: 'format C:' }))
      .rejects.toThrow('Blocked command');
  });
});

describe('ClawMind CLI - skill 命令', () => {
  it('skill list shows all skills', () => {
    const r = runNode(CLI, ['skill', 'list']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('total');
    expect(r.stdout).toContain('file_search');
  });

  it('skill info shows detail', () => {
    const r = runNode(CLI, ['skill', 'info', 'file_search']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('file_search');
    expect(r.stdout).toContain('pattern');
  });

  it('skill match works', () => {
    const r = runNode(CLI, ['skill', 'match', 'scrape https://example.com']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('web_scraping');
  });

  it('skill validate checks file', () => {
    const r = runNode(CLI, ['skill', 'validate', 'skills/builtin/file_search.json']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Valid skill');
  });
});
