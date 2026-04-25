# ClawMind 完善方案

> 生成时间: 2026-04-24
> 基于: SESSION_BACKUP_20260424.md + 全量代码审计

---

## 一、当前问题总览

经过全量代码审计，发现以下关键问题：

| # | 严重度 | 问题 | 影响 |
|---|--------|------|------|
| 1 | 🔴 严重 | 6 个内置 Skill 中 3 个格式不兼容，加载即失败 | 功能缺失 |
| 2 | 🔴 严重 | desktop_operations.py 是死代码，从未被调用 | 桌面操作全部无效 |
| 3 | 🔴 严重 | 参数占位符 `{{xxx}}` 未从用户输入提取 | Skills 无法接收动态参数 |
| 4 | 🟡 中等 | client.js 中 executeCommand/executeAction 130 行重复代码 | 维护成本 |
| 5 | 🟡 中等 | 双配置系统共存 (config.js vs config-manager.js) | 配置混乱 |
| 6 | 🟡 中等 | 无测试框架，全部靠 console.log 手动检查 | 无法持续集成 |
| 7 | 🟡 中等 | SkillsIntegration 每次 subprocess 调用 Node.js | 性能开销 |
| 8 | 🟢 低 | 文件/终端操作无路径沙箱 | 安全隐患 |
| 9 | 🟢 低 | core/index.js 引用不存在的路径 | 死代码 |
| 10 | 🟢 低 | config.default.json 使用相对路径 `../data` | 跨环境兼容 |

---

## 二、分阶段实施计划

### 阶段 1：修复核心 Bug（预计 1-2 天）

> 目标：让现有功能 100% 可用

---

#### 1.1 修复 3 个不兼容的内置 Skills

**问题：** `file_backup.json`、`web_scraping.json`、`screenshot_and_save.json` 使用旧格式（`id`/`steps`），而 `parser.js` 的 `validateSkill()` 要求新格式（`name`/`trigger`/`actions`），导致加载失败。

**方案：** 将这 3 个 Skill 转换为新格式。

**文件修改清单：**

```
skills/builtin/file_backup.json     → 重写为新格式
skills/builtin/web_scraping.json    → 重写为新格式
skills/builtin/screenshot_and_save.json → 重写为新格式
```

**新格式模板（以 file_backup.json 为例）：**

```json
{
  "name": "File Backup",
  "description": "备份指定文件或目录到指定位置",
  "version": "1.0.0",
  "trigger": {
    "keywords": ["backup", "备份", "备份文件", "file backup"],
    "patterns": ["backup {path}", "备份 {path}"]
  },
  "parameters": [
    {
      "name": "source",
      "type": "string",
      "required": true,
      "description": "源文件或目录路径"
    },
    {
      "name": "destination",
      "type": "string",
      "required": false,
      "default": "./backup/",
      "description": "备份目标路径"
    }
  ],
  "actions": [
    {
      "action": "file.copy",
      "params": {
        "source": "{{source}}",
        "destination": "{{destination}}"
      }
    },
    {
      "action": "notification.send",
      "params": {
        "title": "备份完成",
        "message": "{{source}} 已备份到 {{destination}}"
      }
    }
  ]
}
```

---

#### 1.2 连通桌面操作执行链

**问题：** `hermes/modules/desktop_operations.py` 定义了完整的桌面操作（截图、鼠标、键盘），但 `server.py` 从未导入它。同时 `openclaw/client.js` 的 `desktopScreenshot()` 只返回占位符。

**方案：** 在 Hermes 的 executor 中添加桌面操作支持，并通过 WebSocket 消息传递实现跨进程桌面控制。

**文件修改清单：**

```
hermes/executor.py           → 添加桌面操作执行路径
hermes/server.py             → 注册桌面操作模块
openclaw/client.js           → desktopScreenshot() 改为通过 WebSocket 请求 Hermes 执行
```

**executor.py 改动要点：**

```python
# 新增
from modules.desktop_operations import DesktopOperations

class TaskExecutor:
    def __init__(self):
        self.desktop = DesktopOperations()

    # 在 execute_step 中添加桌面操作分发
    async def execute_step(self, step):
        action = step.get('action', '')
        if action.startswith('desktop.'):
            return await self._execute_desktop(action, step.get('params', {}))

    async def _execute_desktop(self, action, params):
        method_map = {
            'desktop.screenshot': self.desktop.screenshot,
            'desktop.mouse_move': self.desktop.mouse_move,
            'desktop.mouse_click': self.desktop.mouse_click,
            'desktop.key_type': self.desktop.keyboard_type,
            'desktop.key_press': self.desktop.keyboard_press,
            'desktop.key_hotkey': self.desktop.keyboard_hotkey,
            # ... 其余方法
        }
        method = method_map.get(action)
        if method:
            return method(**params)
        return {'success': False, 'error': f'Unknown action: {action}'}
```

**client.js 改动要点：**

```javascript
// desktopScreenshot 改为向 Hermes 请求
async desktopScreenshot(params = {}) {
    // 通过 WebSocket 发送 desktop.screenshot 请求
    // Hermes 端的 desktop_operations.py 执行实际截图
    // 返回截图数据
    return this.sendDesktopRequest('desktop.screenshot', params);
}
```

---

#### 1.3 实现参数提取系统

**问题：** Skill 定义中的 `{{param}}` 模板变量原样传递，未从用户输入提取实际值。

**方案：** 在 `matcher.js` 的 `extractParameters()` 中实现基于触发模式 + LLM 回退的参数提取。

**文件修改清单：**

```
skills/matcher.js            → 增强 extractParameters()
skills/executor.js           → 增强 resolveParameters()
```

**matcher.js 参数提取逻辑：**

```javascript
// 策略 1：从 trigger.patterns 提取（正则匹配）
// 例如 pattern "backup {path}" → 用户输入 "backup C:/docs" → { path: "C:/docs" }

extractParameters(input, skill) {
    const params = {};

    // 策略 1：模式匹配提取
    if (skill.trigger?.patterns) {
        for (const pattern of skill.trigger.patterns) {
            const regex = patternToRegex(pattern); // {xxx} → (?<xxx>.+)
            const match = input.match(regex);
            if (match?.groups) {
                Object.assign(params, match.groups);
            }
        }
    }

    // 策略 2：从 parameter 定义中提取（keyword-based）
    // 如果模式匹配没提取到，尝试根据参数描述从输入中推断

    // 策略 3：使用默认值填充未提取到的参数
    if (skill.parameters) {
        for (const param of skill.parameters) {
            if (!params[param.name] && 'default' in param) {
                params[param.name] = param.default;
            }
        }
    }

    return params;
}

// 将 "{name}" 占位符转换为命名捕获组正则
function patternToRegex(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withGroups = escaped.replace(/\\{(\w+)\\}/g, '(?<$1>.+?)');
    return new RegExp('^' + withGroups + '$', 'i');
}
```

**executor.js 参数解析逻辑：**

```javascript
// 在执行前替换 {{param}} 和 {{step1.result.xxx}}
resolveParameters(actionParams, userInput, stepResults, extractedParams) {
    const resolved = {};
    for (const [key, value] of Object.entries(actionParams)) {
        if (typeof value !== 'string') {
            resolved[key] = value;
            continue;
        }
        let result = value;
        // 替换 {{paramName}} 为提取的参数
        result = result.replace(/\{\{(\w+)\}\}/g, (match, name) => {
            return extractedParams[name] ?? match;
        });
        // 替换 {{stepN.result.xxx}} 为前序步骤结果
        result = result.replace(/\{\{step(\d+)\.result\.(\w+)\}\}/g, (match, step, field) => {
            return stepResults[step]?.[field] ?? match;
        });
        resolved[key] = result;
    }
    return resolved;
}
```

---

### 阶段 2：代码重构与质量提升（预计 2-3 天）

> 目标：消除重复代码，统一架构，提升可维护性

---

#### 2.1 消除 client.js 中的重复 Switch

**问题：** `executeCommand()` 和 `executeAction()` 是两个几乎相同的 ~130 行 switch 语句。

**方案：** 统一为一个 action 映射表 + 单一执行入口。

```javascript
// 新的 action 映射方式
this.actionHandlers = {
    // 文件操作
    'file.read':          (p) => this.file.read(p.path, p.encoding),
    'file.write':         (p) => this.file.write(p.path, p.content, p.encoding),
    'file.delete':        (p) => this.file.delete(p.path),
    'file.list':          (p) => this.file.list(p.path, p.recursive),
    'file.search':        (p) => this.file.search(p.directory, p.pattern),
    'file.copy':          (p) => this.file.copy(p.source, p.destination),
    'file.move':          (p) => this.file.move(p.source, p.destination),
    'file.info':          (p) => this.file.info(p.path),

    // 终端操作
    'terminal.exec':      (p) => this.terminal.exec(p.command, p.options),
    'terminal.stream':    (p) => this.terminal.execStream(p.command),
    'terminal.cwd':       (p) => this.terminal.getCwd(),

    // 浏览器操作
    'browser.open':       (p) => this.browser.open(p.url),
    'browser.click':      (p) => this.browser.click(p.selector),
    'browser.input':      (p) => this.browser.input(p.selector, p.value),
    'browser.extract':    (p) => this.browser.extract(p.selector),
    'browser.screenshot': (p) => this.browser.screenshot(p.path),
    'browser.wait_for':   (p) => this.browser.waitFor(p.selector, p.timeout),
    'browser.close':      ()   => this.browser.close(),
    'browser.navigate':   (p) => this.browser.navigate(p.url),
    'browser.evaluate':   (p) => this.browser.evaluate(p.script),

    // 剪贴板操作
    'clipboard.read':     ()   => this.clipboard.read(),
    'clipboard.write':    (p)  => this.clipboard.write(p.text),
    'clipboard.clear':    ()   => this.clipboard.clear(),

    // 桌面操作（转发到 Hermes）
    'desktop.capture_screen': (p) => this.sendDesktopRequest('desktop.screenshot', p),
    'desktop.mouse_move':     (p) => this.sendDesktopRequest('desktop.mouse_move', p),
    'desktop.mouse_click':    (p) => this.sendDesktopRequest('desktop.mouse_click', p),
    'desktop.key_type':       (p) => this.sendDesktopRequest('desktop.key_type', p),
    'desktop.key_press':      (p) => this.sendDesktopRequest('desktop.key_press', p),

    // 通知
    'notification.send':  (p) => this.notifier.send(p),

    // Skills
    'skill.execute':      (p) => this.skills.executeSkill(p.skillName, p.params),
};

// 统一执行入口
async executeAction(action, params = {}) {
    const handler = this.actionHandlers[action];
    if (!handler) {
        return { success: false, error: `Unknown action: ${action}` };
    }
    return handler(params);
}

// executeCommand 也走这个映射
async executeCommand(command) {
    const { action, ...params } = command;
    return this.executeAction(action, params);
}
```

**效果：** 从 ~260 行重复代码 → ~60 行映射表。

---

#### 2.2 统一配置系统

**问题：** `config.js`（143 行）和 `config-manager.js`（450 行）并存，有不同的默认值和行为。

**方案：** 保留 `config-manager.js` 作为唯一配置引擎，`config.js` 改为 thin wrapper。

```
src/utils/config.js           → 改为 re-export config-manager.js 的方法
src/utils/config-manager.js   → 保留，修正默认路径为绝对路径
config/config.schema.json     → 更新为新格式 schema
config/config.default.json    → 修正 dataDir 为绝对路径
```

**config.js 简化为：**

```javascript
const { ConfigManager } = require('./config-manager');
const instance = new ConfigManager();
module.exports = {
    loadConfig: () => instance.getConfig(),
    saveConfig: (c) => instance.saveConfig(c),
    validateConfig: (c) => instance.validate(c),
    // ... 其他方法代理
};
```

---

#### 2.3 清理死代码

**删除或修复的文件：**

| 文件 | 操作 | 原因 |
|------|------|------|
| `core/index.js` | 删除 | 引用不存在的路径，被 src/commands/start.js 替代 |
| `skills/index.js` | 删除 | 旧的 SkillSystem 实现，被 manager.js 替代 |
| `test-task-run.js`（根目录） | 移到 test/ | 归类 |

---

#### 2.4 添加正规测试框架

**方案：** 引入 Vitest（快速、兼容 Node.js、零配置）。

```bash
npm install -D vitest
```

**测试文件结构：**

```
test/
├── unit/
│   ├── skills-parser.test.js      # Skill 解析器测试
│   ├── skills-matcher.test.js     # Skill 匹配器测试（含参数提取）
│   ├── skills-executor.test.js    # Skill 执行器测试
│   ├── config-manager.test.js     # 配置管理测试
│   ├── file-operations.test.js    # 文件操作测试
│   └── terminal-operations.test.js
├── integration/
│   ├── skills-integration.test.js # Skills 端到端测试
│   └── hermes-openclaw.test.js    # WebSocket 通信测试
└── vitest.config.js
```

**示例测试（skills-matcher）：**

```javascript
import { describe, it, expect } from 'vitest';
import { matchSkill, extractParameters } from '../../skills/matcher.js';

describe('Skill Matcher', () => {
    const skills = [
        { name: 'Screenshot', trigger: { keywords: ['screenshot', '截图'], patterns: ['take a screenshot', 'screenshot {region}'] }, parameters: [{ name: 'region', default: 'full' }] },
    ];

    it('should match by keyword', () => {
        const result = matchSkill('take a screenshot', skills);
        expect(result.skill.name).toBe('Screenshot');
        expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should extract parameters from pattern', () => {
        const params = extractParameters('screenshot top-left', skills[0]);
        expect(params.region).toBe('top-left');
    });

    it('should use default for missing params', () => {
        const params = extractParameters('take a screenshot', skills[0]);
        expect(params.region).toBe('full');
    });
});
```

---

### 阶段 3：功能增强（预计 3-5 天）

> 目标：扩展 Skills 能力、完善桌面控制、提升用户体验

---

#### 3.1 安装 node-notifier 实现通知

```bash
cd openclaw && npm install node-notifier
```

OpenClaw 已有 `notifications/` 模块包装了 node-notifier，但依赖未安装。安装后通知即可正常工作。

---

#### 3.2 添加新内置 Skills（6-8 个）

```
skills/builtin/
├── file_copy.json           # 复制文件
├── file_move.json           # 移动文件
├── file_delete.json         # 删除文件
├── text_search.json         # 搜索文本内容
├── system_info.json         # 系统信息（CPU/内存/磁盘）
├── http_request.json        # HTTP 请求（GET/POST）
├── app_launch.json          # 启动应用程序
└── window_manage.json       # 窗口管理（最小化/最大化/关闭）
```

**system_info.json 示例：**

```json
{
  "name": "System Info",
  "description": "获取系统信息（CPU、内存、磁盘使用情况）",
  "version": "1.0.0",
  "trigger": {
    "keywords": ["system info", "系统信息", "cpu", "memory", "内存", "磁盘", "disk"],
    "patterns": ["show system info", "check {resource}"]
  },
  "parameters": [
    {
      "name": "resource",
      "type": "enum",
      "enum": ["all", "cpu", "memory", "disk"],
      "required": false,
      "default": "all"
    }
  ],
  "actions": [
    {
      "action": "terminal.exec",
      "params": {
        "command": "{{command}}"
      }
    },
    {
      "action": "notification.send",
      "params": {
        "title": "系统信息",
        "message": "{{step1.result.stdout}}"
      }
    }
  ]
}
```

---

#### 3.3 Skills 执行重试机制

**在 `executor.js` 中添加：**

```javascript
class SkillExecutor extends EventEmitter {
    constructor(options = {}) {
        this.retryConfig = {
            maxRetries: options.maxRetries ?? 2,
            backoffMs: options.backoffMs ?? 1000,
            retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'],
        };
    }

    async executeActionWithRetry(action, params, depth = 0) {
        try {
            return await this.executeAction(action, params);
        } catch (err) {
            if (depth >= this.retryConfig.maxRetries) throw err;
            if (!this.isRetryable(err)) throw err;

            const delay = this.retryConfig.backoffMs * Math.pow(2, depth);
            this.emit('retry', { action, attempt: depth + 1, delay });
            await new Promise(r => setTimeout(r, delay));
            return this.executeActionWithRetry(action, params, depth + 1);
        }
    }

    isRetryable(err) {
        return this.retryConfig.retryableErrors.some(e =>
            err.code === e || err.message?.includes(e)
        );
    }
}
```

---

#### 3.4 性能优化：Skills 缓存

**问题：** 每次 Python 调用 `SkillsIntegration.match_input()` 都启动新的 Node.js 进程。

**方案 A（简单）：** 在 Python 端添加内存缓存。

```python
# hermes/skills_integration.py
import time

class SkillsIntegration:
    def __init__(self):
        self._skills_cache = None
        self._cache_time = 0
        self._cache_ttl = 300  # 5 分钟

    def list_skills(self):
        if self._skills_cache and (time.time() - self._cache_time < self._cache_ttl):
            return self._skills_cache
        result = self._run_cli(['list'])
        self._skills_cache = result
        self._cache_time = time.time()
        return result
```

**方案 B（更好，后续考虑）：** 将 Skills CLI 改为长驻进程，通过 stdin/stdout JSON-RPC 通信。

---

### 阶段 4：安全加固（预计 1-2 天）

> 目标：防止路径遍历、命令注入等安全风险

---

#### 4.1 文件操作路径沙箱

**在 `file-operations.js` 中添加：**

```javascript
class FileOperations {
    constructor(sandboxDir = null) {
        this.sandboxDir = sandboxDir; // null = 不限制
    }

    validatePath(path) {
        if (!this.sandboxDir) return true;
        const resolved = path.resolve(path);
        if (!resolved.startsWith(this.sandboxDir)) {
            throw new Error(`Path escapes sandbox: ${path}`);
        }
        return true;
    }

    // 在每个方法开头调用
    async read(filePath, encoding = 'utf-8') {
        this.validatePath(filePath);
        // ... 原有逻辑
    }
}
```

---

#### 4.2 终端命令白名单/黑名单

```javascript
class TerminalOperations {
    constructor(options = {}) {
        this.blockedCommands = options.blockedCommands ?? [
            'rm -rf /', 'format', 'del /f /s /q C:\\',
            'shutdown', 'taskkill /f', 'reg delete',
        ];
    }

    validateCommand(cmd) {
        const lower = cmd.toLowerCase().trim();
        for (const blocked of this.blockedCommands) {
            if (lower.includes(blocked.toLowerCase())) {
                throw new Error(`Blocked command: ${blocked}`);
            }
        }
    }
}
```

---

#### 4.3 API Key 加密存储

当前 API Key 明文存储在 `config.json` 中。改为：

```javascript
// 使用系统 keychain（Windows Credential Manager / macOS Keychain）
// 简单方案：base64 混淆（不安全但比明文好）
// 完整方案：使用 keytar 包

const keytar = require('keytar');
await keytar.setPassword('ClawMind', 'api-key', apiKey);
const key = await keytar.getPassword('ClawMind', 'api-key');
```

---

### 阶段 5：用户体验（预计 2-3 天）

> 目标：提升 Desktop UI 和 CLI 体验

---

#### 5.1 Skills 管理 CLI

```bash
clawmind skill list                # 列出所有 Skills
clawmind skill info <name>         # 查看 Skill 详情
clawmind skill test <name>         # 测试 Skill
clawmind skill create <name>       # 创建新 Skill（交互式向导）
clawmind skill validate <file>     # 验证 Skill 文件格式
clawmind skill install <url>       # 从 URL 安装 Skill
clawmind skill remove <name>       # 移除 Skill
```

---

#### 5.2 Desktop UI 增强

- 添加 Skill 管理面板（查看/测试/启停）
- 任务执行时实时显示当前执行的 Skill 和步骤
- 错误提示优化（显示具体失败步骤和原因）

---

## 三、实施优先级时间线

```
Week 1 (Day 1-2):  阶段 1 - 修复核心 Bug
  ├── Day 1: 修复 3 个 Skill 格式 + 参数提取系统
  └── Day 2: 连通桌面操作执行链

Week 1 (Day 3-5):  阶段 2 - 代码重构
  ├── Day 3: 消除 client.js 重复代码
  ├── Day 4: 统一配置 + 清理死代码
  └── Day 5: 引入 Vitest + 编写核心单元测试

Week 2 (Day 6-10): 阶段 3 - 功能增强
  ├── Day 6-7: 添加 6-8 个新 Skills
  ├── Day 8: 重试机制 + 性能缓存
  └── Day 9-10: 安装依赖 + 集成测试

Week 2-3:          阶段 4+5 - 安全 + UX
  ├── Day 11-12: 路径沙箱 + 命令过滤
  └── Day 13-15: Skills CLI + UI 增强
```

---

## 四、立即可做的快速修复（30 分钟内）

这些改动小但收益高，可以立即执行：

1. **安装 node-notifier** — `cd openclaw && npm install node-notifier`
2. **修复 3 个 Skill 格式** — 直接重写 JSON 文件
3. **删除死代码** — 移除 `core/index.js`、`skills/index.js`
4. **修复 config.default.json** — `../data` → 绝对路径

---

## 五、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构 client.js 可能引入回归 | 所有操作中断 | 先写测试再重构 |
| 桌面操作连通需要修改 WebSocket 协议 | 通信协议变更 | 向后兼容，添加新的消息类型 |
| 参数提取可能不够智能 | 用户体验不佳 | 提供 LLM 回退方案 |
| Puppeteer 在某些环境不可用 | 浏览器操作失败 | 已有 graceful fallback |

---

## 六、验证清单（每个阶段完成后）

```bash
# 1. 所有 Skill 加载正常
node skills/cli.js list
# 预期：6 个 Skill 全部列出

# 2. Skill 匹配和参数提取
node skills/cli.js match "备份 C:/docs 到 D:/backup"
# 预期：匹配 file_backup，参数 source=C:/docs, destination=D:/backup

# 3. 桌面截图
# 通过 Desktop UI 或 WebSocket 发送 desktop.screenshot 请求
# 预期：返回真实截图数据

# 4. 运行测试
npx vitest run
# 预期：全部通过

# 5. 端到端测试
node test/test-skills-integration.js
# 预期：Skills 和 LLM 回退都正常

# 6. 通知测试
# 触发包含 notification.send 的 Skill
# 预期：桌面通知弹出
```
