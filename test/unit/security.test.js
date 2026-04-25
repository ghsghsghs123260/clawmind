import { describe, it, expect } from 'vitest';
import FileOperations from '../../openclaw/modules/file-operations.js';
import { TerminalOperations, BLOCKED_PATTERNS } from '../../openclaw/modules/terminal-operations.js';

describe('FileOperations - 路径沙箱', () => {
  it('allows paths inside sandbox', () => {
    const fo = new FileOperations('C:/Users/test/workspace');
    // 不抛异常 = 通过
    expect(() => fo.validatePath('C:/Users/test/workspace/file.txt')).not.toThrow();
    expect(() => fo.validatePath('C:/Users/test/workspace/sub/deep/file.txt')).not.toThrow();
  });

  it('blocks paths escaping sandbox via ..', () => {
    const fo = new FileOperations('C:/Users/test/workspace');
    expect(() => fo.validatePath('C:/Users/test/workspace/../../../etc/passwd')).toThrow('Path escapes sandbox');
  });

  it('blocks paths outside sandbox', () => {
    const fo = new FileOperations('C:/Users/test/workspace');
    expect(() => fo.validatePath('C:/Windows/System32/config')).toThrow('Path escapes sandbox');
    expect(() => fo.validatePath('D:/secrets/key.pem')).toThrow('Path escapes sandbox');
  });

  it('allows all paths when sandbox is null', () => {
    const fo = new FileOperations(null);
    expect(() => fo.validatePath('/etc/passwd')).not.toThrow();
    expect(() => fo.validatePath('C:/Windows/System32')).not.toThrow();
  });

  it('validates both source and destination in validatePaths', () => {
    const fo = new FileOperations('C:/project');
    expect(() => fo.validatePaths('C:/project/a.txt', 'C:/project/b.txt')).not.toThrow();
    expect(() => fo.validatePaths('C:/project/a.txt', 'C:/evil/b.txt')).toThrow('Path escapes sandbox');
  });
});

describe('TerminalOperations - 命令黑名单', () => {
  it('allows normal commands', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('dir')).not.toThrow();
    expect(() => t.validateCommand('echo hello')).not.toThrow();
    expect(() => t.validateCommand('node --version')).not.toThrow();
    expect(() => t.validateCommand('python script.py')).not.toThrow();
    expect(() => t.validateCommand('git status')).not.toThrow();
  });

  it('blocks rm -rf / variants', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('rm -rf /')).toThrow('Blocked command');
    expect(() => t.validateCommand('rm -fr /')).toThrow('Blocked command');
  });

  it('blocks shutdown and reboot', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('shutdown /s /t 0')).toThrow('Blocked command');
    expect(() => t.validateCommand('shutdown now')).toThrow('Blocked command');
    expect(() => t.validateCommand('reboot')).toThrow('Blocked command');
  });

  it('blocks format command', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('format C:')).toThrow('Blocked command');
  });

  it('blocks taskkill /f', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('taskkill /F /IM explorer.exe')).toThrow('Blocked command');
  });

  it('blocks registry modification', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('reg delete HKLM\\SOFTWARE\\Test')).toThrow('Blocked command');
  });

  it('blocks diskpart and fdisk', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('diskpart')).toThrow('Blocked command');
    expect(() => t.validateCommand('fdisk /dev/sda')).toThrow('Blocked command');
  });

  it('handles empty/null commands gracefully', () => {
    const t = new TerminalOperations();
    expect(() => t.validateCommand('')).not.toThrow();
    expect(() => t.validateCommand(null)).not.toThrow();
    expect(() => t.validateCommand(undefined)).not.toThrow();
  });

  it('BLOCKED_PATTERNS is exported and non-empty', () => {
    expect(Array.isArray(BLOCKED_PATTERNS)).toBe(true);
    expect(BLOCKED_PATTERNS.length).toBeGreaterThan(0);
  });
});
