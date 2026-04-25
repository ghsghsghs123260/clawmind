const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 危险命令黑名单
 * 匹配命令中是否包含这些模式（不区分大小写）
 */
const BLOCKED_PATTERNS = [
  // 系统破坏
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|--)\/\s*$/,                    // rm -rf /
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?-[a-zA-Z]*r[a-zA-Z]*\s+\/\s/i, // rm -rf /
  /\bdel\s+\/[fF]\s+\/[sS]\s+\/[qQ]\s+C:\\/i,                     // del /f /s /q C:\
  /\bformat\s+[A-Za-z]:/i,                                          // format C:
  /\bshutdown\b/i,                                                   // shutdown
  /\breboot\b/i,                                                     // reboot
  /\bhalt\b/i,                                                       // halt
  /\bpoweroff\b/i,                                                   // poweroff
  // 进程/服务
  /\btaskkill\s+\/[fF]/i,                                           // taskkill /f
  /\bkill\s+-9\s+1\b/,                                              // kill -9 1 (init)
  /\bnet\s+(stop|user|localgroup)\b/i,                              // net stop/user/localgroup
  // 注册表
  /\breg\s+(delete|add)\s+HKLM/i,                                   // reg delete HKLM
  // 磁盘
  /\bdiskpart\b/i,                                                   // diskpart
  /\bfdisk\b/i,                                                      // fdisk
  // 权限
  /\bchmod\s+(-R\s+)?777\s+\//i,                                    // chmod 777 /
  /\bchown\s+(-R\s+)?\w+\s+\//i,                                    // chown /
  // Shell injection via chained commands
  /[;&|`]\s*(?:del|rm|format|shutdown|reboot|taskkill|reg|diskpart|fdisk|net|powershell|cmd|cmdkey|cipher|icacls|takeown|sc|schtasks|wmic)\b/i,
];

/**
 * 终端命令执行模块（带命令安全过滤）
 */
class TerminalOperations {
  constructor(options = {}) {
    this.blockedPatterns = options.blockedPatterns ?? BLOCKED_PATTERNS;
    this.allowBypass = options.allowBypass ?? false;
  }

  /**
   * 检查命令是否被阻止
   * @throws 如果命令匹配黑名单
   */
  validateCommand(command) {
    if (!command || typeof command !== 'string') return;

    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Blocked command: "${command}" matches dangerous pattern`);
      }
    }
  }

  async exec(params) {
    const { command, cwd, timeout = 30000, shell = true } = params;

    if (!command) throw new Error('缺少参数: command');
    this.validateCommand(command);

    try {
      const options = {
        cwd: cwd || process.cwd(),
        timeout: timeout,
        shell: shell,
        maxBuffer: 1024 * 1024 * 10
      };

      const { stdout, stderr } = await execAsync(command, options);

      return {
        success: true,
        command: command,
        stdout: stdout,
        stderr: stderr,
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        command: command,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  async execScript(params) {
    const { scriptPath, args = [], cwd, timeout = 30000 } = params;
    if (!scriptPath) throw new Error('缺少参数: scriptPath');

    const command = `"${scriptPath}" ${args.join(' ')}`;
    return await this.exec({ command, cwd, timeout });
  }

  async execStream(params, onData) {
    const { command, cwd, shell = true, timeout = 60000 } = params;

    if (!command) throw new Error('缺少参数: command');
    this.validateCommand(command);

    return new Promise((resolve, reject) => {
      const options = { cwd: cwd || process.cwd(), shell };
      const child = spawn(command, [], options);

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill();
          resolve({ success: false, command, stdout, stderr, exitCode: -1, error: 'Command timed out' });
        }
      }, timeout);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onData) onData({ type: 'stdout', data: text });
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onData) onData({ type: 'stderr', data: text });
      });

      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: code === 0, command, stdout, stderr, exitCode: code });
        }
      });

      child.on('error', (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`执行命令失败: ${error.message}`));
        }
      });
    });
  }

  async getCwd() {
    return { success: true, cwd: process.cwd() };
  }

  async setCwd(params) {
    const { path: dirPath } = params;
    if (!dirPath) throw new Error('缺少参数: path');

    try {
      process.chdir(dirPath);
      return { success: true, cwd: process.cwd() };
    } catch (error) {
      throw new Error(`改变目录失败: ${error.message}`);
    }
  }

  async getEnv(params) {
    const { key } = params;
    if (key) {
      return { success: true, key, value: process.env[key] || null };
    }
    return { success: true, env: process.env };
  }

  async setEnv(params) {
    const { key, value } = params;
    if (!key) throw new Error('缺少参数: key');
    process.env[key] = value || '';
    return { success: true, key, value: process.env[key] };
  }

  async commandExists(params) {
    const { command } = params;
    if (!command) throw new Error('缺少参数: command');

    try {
      const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
      const { stdout } = await execAsync(checkCmd);
      return { success: true, command, exists: true, path: stdout.trim() };
    } catch (error) {
      return { success: true, command, exists: false, path: null };
    }
  }
}

module.exports = { TerminalOperations, BLOCKED_PATTERNS };
