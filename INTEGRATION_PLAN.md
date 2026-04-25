# ClawMind 集成真实框架 - 完整完善方案

## 文档信息

| 项目 | 内容 |
|------|------|
| 目标 | 将自研实现替换为真实 OpenClaw + Hermes Agent 框架 |
| 依据 | ClawMind PRD v5.0 |
| 定位 | 扩展层 + 调度层 + 适配层开发 |

---

## 一、现状分析与目标差距

### 1.1 当前架构

```
┌─────────────────────────────────────────────────┐
│              ClawMind Core（自研）               │
│                                                 │
│  ├── hermes/server.py（自研 WebSocket Server）  │
│  ├── hermes/planner.py（自研 LLM 规划器）      │
│  ├── hermes/executor.py（自研执行器）           │
│  └── openclaw/client.js（自研 WS Client）       │
└─────────────────────────────────────────────────┘
```

### 1.2 目标架构（PRD 要求）

```
┌─────────────────────────────────────────────────────────┐
│                   ClawMind 扩展层                        │
│            （ClawMind Core - 自研调度层）                 │
│                                                         │
│  • 统一配置下发                                        │
│  • 进程管理（启动/监控/重启）                           │
│  • 首次配置向导                                        │
│  • doctor 诊断                                         │
│  • UI 桥接                                             │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│    Hermes Agent         │   │       OpenClaw              │
│    （真实框架 - 大脑）   │   │       （真实框架 - 手脚）    │
│                         │   │                             │
│  • pip install 引入     │   │  • npm install 引入         │
│  • WebSocket Server    │   │  • 连接 Hermes              │
│  • 记忆/思考/策略      │   │  • 执行工具调用              │
│  • LLM 规划            │   │  • 桌面/浏览器/文件          │
│  • SQLite 原生记忆     │   │  • Skills 系统              │
└─────────────────────────┘   └─────────────────────────────┘
```

### 1.3 差距对比

| 模块 | 当前（自研） | 目标（真实框架） | 优先级 |
|------|-------------|-----------------|--------|
| WebSocket 通信 | 自研 | 框架原生 | P0 |
| LLM 规划器 | 自研 | 框架自带 | P0 |
| 记忆系统 | JSON 文件 | SQLite + FTS5 | P0 |
| 执行器 | 自研 | 框架自带 | P0 |
| 桌面控制 | PyAutoGUI 封装 | OpenClaw 原生 | P1 |
| 浏览器自动化 | Puppeteer 封装 | OpenClaw 原生 | P1 |
| Skills 系统 | 简单 JSON | 框架完整实现 | P1 |
| 策略进化 | 无 | Hermes 原生 | P2 |
| 思考过程流式 | 无 | Hermes 原生 | P2 |

---

## 二、框架调研与选型

### 2.1 Hermes Agent 框架

#### 2.1.1 框架特性（官方）

```
核心能力：
├── 记忆系统（SQLite + FTS5）
├── 思考引擎（LLM 驱动）
├── 策略沉淀（从经验中学习）
├── WebSocket 接口（端口 8765）
└── 技能系统（Python 原生 + MD 格式兼容）

消息协议：
├── task.run - 任务执行
├── memory.* - 记忆操作
├── skill.* - 技能操作
└── think.* - 思考操作
```

#### 2.1.2 官方 Python API

```python
from hermes import HermesAgent

# 初始化
agent = HermesAgent(
    api_key="your-api-key",
    model="gpt-4",
    api_endpoint="https://api.openai.com/v1",
    memory_db="path/to/memory.db",
    websocket_port=8765
)

# 启动
agent.start()

# 发送任务
result = await agent.run_task("读取桌面上的 test.txt")
```

#### 2.1.3 集成方式

```python
# hermes/agent.py - ClawMind 的 Hermes 扩展层

from hermes import HermesAgent
from typing import Dict, Any, Optional
import json
import logging

logger = logging.getLogger('ClawMind.Hermes')

class ClawMindHermes(HermesAgent):
    """ClawMind 专用 Hermes 扩展"""
    
    def __init__(self, config: Dict[str, Any]):
        # 从配置初始化
        super().__init__(
            api_key=config['apiKey'],
            model=config['model'],
            api_endpoint=config['apiEndpoint'],
            memory_db=config.get('memoryDb', './data/memory/hermes.db'),
            websocket_port=config.get('websocketPort', 8765)
        )
        
        self.clawmind_config = config
        self._register_extensions()
    
    def _register_extensions(self):
        """注册 ClawMind 扩展"""
        # 注册自定义技能
        self.register_skill('clawmind_file_ops', self.custom_file_ops)
        self.register_skill('clawmind_desktop', self.custom_desktop_ops)
        
        # 注册自定义思考策略
        self.register_strategy('clawmind_default', self.clawmind_strategy)
    
    async def custom_file_ops(self, params: Dict) -> Dict:
        """自定义文件操作扩展"""
        pass
    
    async def custom_desktop_ops(self, params: Dict) -> Dict:
        """自定义桌面操作扩展"""
        pass
    
    async def clawmind_strategy(self, task: str) -> Dict:
        """ClawMind 专用策略"""
        pass
    
    async def on_task_complete(self, task_id: str, result: Dict):
        """任务完成回调"""
        # 保存到 ClawMind 记忆
        await self.save_to_memory('task_history', {
            'task_id': task_id,
            'result': result
        })
```

### 2.2 OpenClaw 框架

#### 2.2.1 框架特性（官方）

```
核心能力：
├── 工具执行引擎
├── Skills 生态系统（MD 格式）
├── WebSocket Client（连接 Hermes）
├── 桌面控制（PyAutoGUI 原生）
├── 浏览器自动化（Puppeteer 原生）
├── 剪贴板/终端/文件操作
└── 渠道插件（飞书/Telegram/微信）

工具列表（内置）：
├── file.* - 文件操作（8个）
├── terminal.* - 终端操作（6个）
├── browser.* - 浏览器操作（10个）
├── desktop.* - 桌面控制（11个）
├── clipboard.* - 剪贴板（3个）
└── http.* - HTTP 请求
```

#### 2.2.2 官方 Node.js API

```javascript
const { OpenClaw } = require('@openclaw/core');
const { FileTools, TerminalTools, BrowserTools } = require('@openclaw/tools');

const openclaw = new OpenClaw({
  hermesUrl: 'ws://localhost:8765',
  tools: [
    new FileTools(),
    new TerminalTools(),
    new BrowserTools({ headless: false })
  ],
  skills: './skills'
});

openclaw.connect();
```

#### 2.2.3 集成方式

```javascript
// openclaw/index.js - ClawMind 的 OpenClaw 扩展层

const { OpenClaw } = require('@openclaw/core');
const { 
  FileTools, 
  TerminalTools, 
  BrowserTools,
  ClipboardTools,
  DesktopTools
} = require('@openclaw/tools');
const path = require('path');

class ClawMindOpenClaw extends OpenClaw {
  constructor(config) {
    super({
      hermesUrl: config.websocketUrl || 'ws://localhost:8765',
      autoReconnect: true,
      reconnectInterval: 5000,
      requestTimeout: 60000
    });
    
    this.config = config;
    this._registerTools();
    this._registerCustomSkills();
  }
  
  _registerTools() {
    // 文件操作
    this.registerTool(new FileTools({
      allowedPaths: this.config.allowedPaths || ['C:/Users']
    }));
    
    // 终端操作
    this.registerTool(new TerminalTools({
      allowedCommands: ['python', 'node', 'git']
    }));
    
    // 浏览器
    this.registerTool(new BrowserTools({
      headless: false,
      userDataDir: this.config.browserDataDir
    }));
    
    // 桌面控制
    this.registerTool(new DesktopTools({
      screenshotDir: this.config.screenshotDir
    }));
    
    // 剪贴板
    this.registerTool(new ClipboardTools());
  }
  
  _registerCustomSkills() {
    // 注册 ClawMind 专用 Skills
    this.loadSkills(path.join(__dirname, 'skills'));
  }
  
  async executeCommand(action, params) {
    // 执行命令并记录日志
    const result = await super.executeCommand(action, params);
    this.emit('command_executed', { action, params, result });
    return result;
  }
}

module.exports = ClawMindOpenClaw;
```

---

## 三、完整集成方案

### 3.1 目录结构重设计

```
clawmind/
├── README.md
├── package.json                 # Node.js 根依赖
├── requirements.txt             # Python 依赖
├── CLAWMIND_VERSION            # 版本号
│
├── core/                        # ClawMind Core（自研调度层）
│   ├── index.js                 # Core 主入口
│   ├── launcher.js              # 进程启动器
│   ├── supervisor.js            # 进程监控器
│   ├── config-manager.js        # 统一配置管理
│   ├── config-wizard.js         # 配置向导
│   └── doctor.js                # 诊断修复
│
├── hermes/                      # Hermes Agent（真实框架）
│   ├── agent.py                 # ClawMind 扩展类
│   ├── extensions/              # ClawMind 扩展
│   │   ├── __init__.py
│   │   ├── custom_strategies.py # 自定义策略
│   │   ├── memory_bridge.py     # 记忆桥接
│   │   └── skills_bridge.py     # 技能桥接
│   ├── skills/                  # Hermes 原生技能
│   │   └── clawmind_core/      # ClawMind 核心技能
│   │       ├── __init__.py
│   │       └── skill.json
│   ├── memory/                  # 记忆数据
│   │   └── hermes.db           # SQLite 数据库
│   └── requirements.txt         # Hermes 专用依赖
│
├── openclaw/                    # OpenClaw（真实框架）
│   ├── index.js                 # ClawMind 扩展类
│   ├── extensions/              # ClawMind 扩展
│   │   ├── file-security.js     # 文件安全封装
│   │   ├── command-logger.js    # 命令日志
│   │   └── skill-bridge.js      # 技能桥接
│   ├── skills/                  # OpenClaw Skills
│   │   ├── builtin/            # 内置技能
│   │   │   ├── file_backup/
│   │   │   │   └── SKILL.md
│   │   │   └── screenshot/
│   │   │       └── SKILL.md
│   │   └── custom/             # 自定义技能
│   ├── config/                 # OpenClaw 配置
│   │   └── default.json
│   └── package.json            # OpenClaw 依赖
│
├── desktop/                     # 桌面 UI
│   ├── src/
│   │   ├── App.vue
│   │   ├── components/
│   │   ├── stores/
│   │   ├── services/
│   │   │   ├── websocket.js     # WS 连接管理
│   │   │   └── api.js          # Core API 调用
│   │   └── i18n/
│   └── tauri.conf.json
│
├── data/                        # 运行时数据
│   ├── config.json              # 用户配置
│   ├── memory/                  # 记忆数据
│   │   ├── conversations/       # 对话历史
│   │   ├── preferences/         # 用户偏好
│   │   └── knowledge/           # 知识库
│   ├── skills/                  # 技能数据
│   ├── logs/                    # 日志
│   │   ├── hermes/             # Hermes 日志
│   │   │   ├── stdout.log
│   │   │   └── stderr.log
│   │   └── openclaw/           # OpenClaw 日志
│   │       ├── stdout.log
│   │       └── stderr.log
│   └── runtime/                 # 运行时数据
│       ├── hermes.pid
│       └── openclaw.pid
│
├── scripts/                     # 安装脚本
│   ├── setup.bat                # Windows 安装
│   ├── setup.sh                 # Linux/macOS 安装
│   ├── install-deps.bat         # 依赖安装
│   └── post-install.js          # npm postinstall
│
├── tests/                       # 测试
│   ├── unit/
│   │   ├── core.test.js
│   │   ├── hermes.test.js
│   │   └── openclaw.test.js
│   ├── integration/
│   │   ├── task-run.test.js
│   │   └── websocket.test.js
│   └── fixtures/
│
└── docs/                        # 文档
    ├── ARCHITECTURE.md          # 架构文档
    ├── API.md                   # API 文档
    ├── DEPLOYMENT.md            # 部署文档
    └── TROUBLESHOOTING.md       # 排障指南
```

### 3.2 依赖清单

#### 3.2.1 package.json（根目录）

```json
{
  "name": "clawmind",
  "version": "5.0.0",
  "description": "AI Agent System - OpenClaw + Hermes Agent",
  "main": "core/index.js",
  "scripts": {
    "start": "node core/index.js start",
    "stop": "node core/index.js stop",
    "status": "node core/index.js status",
    "doctor": "node core/index.js doctor",
    "config": "node core/index.js config",
    "dev": "cd desktop && npm run dev",
    "build": "cd desktop && npm run build",
    "test": "jest",
    "test:integration": "jest tests/integration",
    "setup": "node scripts/post-install.js",
    "postinstall": "node scripts/post-install.js"
  },
  "keywords": ["ai", "agent", "automation", "hermes", "openclaw"],
  "author": "ClawMind Team",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "python": ">=3.10"
  },
  "dependencies": {
    "chalk": "^4.1.2",
    "commander": "^11.1.0",
    "ws": "^8.16.0",
    "ini": "^4.1.2",
    "shelljs": "^0.8.5"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

#### 3.2.2 package.json（openclaw 目录）

```json
{
  "name": "clawmind-openclaw",
  "version": "5.0.0",
  "description": "OpenClaw integration for ClawMind",
  "main": "index.js",
  "scripts": {
    "test": "jest"
  },
  "dependencies": {
    "@openclaw/core": "^2.0.0",
    "@openclaw/tools": "^2.0.0",
    "@openclaw/skills": "^2.0.0",
    "puppeteer": "^21.6.0",
    "pyautogui": "^0.9.54",
    "clipboardy": "^4.0.0",
    "node-notifier": "^10.0.1",
    "ws": "^8.16.0"
  }
}
```

#### 3.2.3 requirements.txt（根目录）

```txt
# Core dependencies
websockets>=12.0
pyautogui>=0.9.54
pillow>=10.0.0

# Hermes Agent framework
hermes-agent>=1.0.0

# Optional: local model support
# llama-cpp-python>=0.2.0
# ollama>=0.1.0
```

#### 3.2.4 requirements.txt（hermes 目录）

```txt
# Hermes Agent dependencies
hermes-agent>=1.0.0

# Memory and storage
sqlalchemy>=2.0.0
aiosqlite>=0.19.0

# Utilities
python-dotenv>=1.0.0
```

---

## 四、核心模块实现方案

### 4.1 ClawMind Core（调度层）

#### 4.1.1 core/index.js - 主入口

```javascript
/**
 * ClawMind Core - 主入口
 * 
 * 职责：
 * 1. 命令行入口
 * 2. 进程启动/停止/监控
 * 3. 配置管理
 * 4. doctor 诊断
 */

const { program } = require('commander');
const chalk = require('chalk');
const ConfigManager = require('./config-manager');
const Launcher = require('./launcher');
const Supervisor = require('./supervisor');
const Doctor = require('./doctor');
const path = require('path');
const os = require('os');

class ClawMindCore {
  constructor() {
    this.configManager = new ConfigManager();
    this.launcher = new Launcher(this.configManager);
    this.supervisor = new Supervisor(this.configManager);
    this.doctor = new Doctor(this.configManager);
    
    this.CLAWMIND_DIR = path.join(os.homedir(), 'ClawMind');
  }
  
  async start(opts = {}) {
    console.log(chalk.cyan('\n🚀 启动 ClawMind...\n'));
    
    // 1. 确保数据目录存在
    await this.configManager.ensureDataDir();
    
    // 2. 加载配置
    const config = this.configManager.loadConfig();
    
    // 3. 前置检查
    if (!opts.skipDoctor) {
      const issues = await this.doctor.run();
      if (issues.length > 0) {
        console.log(chalk.yellow('\n⚠️  发现环境问题，建议先运行 doctor 修复\n'));
      }
    }
    
    // 4. 启动 Hermes
    console.log(chalk.blue('📦 启动 Hermes Agent...'));
    await this.launcher.startHermes(config);
    
    // 5. 启动 OpenClaw
    console.log(chalk.blue('📦 启动 OpenClaw...'));
    await this.launcher.startOpenClaw(config);
    
    // 6. 启动进程监控
    console.log(chalk.blue('📦 启动进程监控...'));
    this.supervisor.start();
    
    // 7. 等待服务就绪
    console.log(chalk.blue('⏳ 等待服务就绪...'));
    await this.waitForServices(config.websocketPort || 8765);
    
    console.log(chalk.green('\n✅ ClawMind 已启动\n'));
    console.log(chalk.gray(`   WebSocket: ws://localhost:${config.websocketPort || 8765}`));
    console.log(chalk.gray(`   数据目录: ${this.CLAWMIND_DIR}\n`));
  }
  
  async stop() {
    console.log(chalk.yellow('\n🛑 停止 ClawMind...\n'));
    
    await this.launcher.stopAll();
    this.supervisor.stop();
    
    console.log(chalk.green('\n✅ ClawMind 已停止\n'));
  }
  
  async status() {
    const status = await this.supervisor.getStatus();
    
    console.log('\n📊 ClawMind 状态\n');
    console.log(`   Hermes:   ${status.hermes.running ? chalk.green('运行中') : chalk.red('已停止')} (PID: ${status.hermes.pid || 'N/A'})`);
    console.log(`   OpenClaw: ${status.openclaw.running ? chalk.green('运行中') : chalk.red('已停止')} (PID: ${status.openclaw.pid || 'N/A'})`);
    console.log(`   WebSocket: ${status.websocket ? chalk.green('可用') : chalk.red('不可用')}`);
    console.log('');
  }
  
  async doctor(opts = {}) {
    console.log(chalk.cyan('\n🔍 ClawMind 诊断中...\n'));
    
    const results = await this.doctor.runFull();
    
    // 显示结果
    for (const check of results) {
      if (check.status === 'pass') {
        console.log(`   ${chalk.green('✓')} ${check.name}`);
      } else if (check.status === 'warn') {
        console.log(`   ${chalk.yellow('⚠')} ${check.name}: ${check.message}`);
      } else if (check.status === 'fail') {
        console.log(`   ${chalk.red('✗')} ${check.name}: ${check.message}`);
      }
    }
    
    // 自动修复
    if (opts.fix) {
      console.log(chalk.cyan('\n🔧 自动修复中...\n'));
      await this.doctor.fixAll(results);
    }
    
    console.log('');
  }
  
  async waitForServices(port, timeout = 30000) {
    const WebSocket = require('ws');
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const ws = new WebSocket(`ws://localhost:${port}`);
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          setTimeout(reject, 1000);
        });
        ws.close();
        return true;
      } catch {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    throw new Error('服务启动超时');
  }
}

// CLI 入口
function main() {
  const core = new ClawMindCore();
  
  program
    .name('clawmind')
    .description('ClawMind - AI Agent System')
    .version('5.0.0');
  
  program
    .command('start')
    .description('启动 ClawMind')
    .option('--skip-doctor', '跳过环境检查')
    .option('--force', '强制重启')
    .action(async (opts) => {
      try {
        await core.start(opts);
      } catch (err) {
        console.error(chalk.red('\n❌ 启动失败:'), err.message);
        process.exit(1);
      }
    });
  
  program
    .command('stop')
    .description('停止 ClawMind')
    .action(async () => {
      try {
        await core.stop();
      } catch (err) {
        console.error(chalk.red('\n❌ 停止失败:'), err.message);
        process.exit(1);
      }
    });
  
  program
    .command('status')
    .description('查看状态')
    .action(async () => {
      await core.status();
    });
  
  program
    .command('doctor')
    .description('诊断环境')
    .option('--fix', '自动修复问题')
    .action(async (opts) => {
      await core.doctor(opts);
    });
  
  // ... 其他命令
  
  program.parse(process.argv);
  
  if (!process.argv.slice(2).length) {
    program.help();
  }
}

if (require.main === module) {
  main();
}

module.exports = ClawMindCore;
```

#### 4.1.2 core/launcher.js - 进程启动器

```javascript
/**
 * ClawMind Core - 进程启动器
 * 
 * 职责：
 * 1. 启动 Hermes Agent 进程
 * 2. 启动 OpenClaw 进程
 * 3. 进程生命周期管理
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

class Launcher {
  constructor(configManager) {
    this.configManager = configManager;
    this.processes = {
      hermes: null,
      openclaw: null
    };
  }
  
  /**
   * 启动 Hermes Agent
   */
  async startHermes(config) {
    const port = config.websocketPort || 8765;
    const hermesDir = path.join(__dirname, '..', 'hermes');
    const agentScript = path.join(hermesDir, 'agent.py');
    
    // 确保目录存在
    if (!fs.existsSync(hermesDir)) {
      throw new Error(`Hermes 目录不存在: ${hermesDir}`);
    }
    
    // 构建环境变量
    const env = {
      ...process.env,
      CLAWMIND_DIR: this.configManager.getDataDir(),
      CLAWMIND_HERMES_DIR: path.join(this.configManager.getDataDir(), 'hermes'),
      CLAWMIND_WEBSOCKET_PORT: String(port),
      CLAWMIND_API_KEY: config.apiKey,
      CLAWMIND_MODEL: config.model,
      CLAWMIND_API_ENDPOINT: config.apiEndpoint,
      CLAWMIND_AUTH_HEADER: config.authHeaderName,
      CLAWMIND_AUTH_PREFIX: config.authHeaderValuePrefix || ''
    };
    
    // 日志文件
    const logDir = path.join(this.configManager.getDataDir(), 'logs', 'hermes');
    fs.mkdirSync(logDir, { recursive: true });
    const stdout = fs.openSync(path.join(logDir, 'stdout.log'), 'a');
    const stderr = fs.openSync(path.join(logDir, 'stderr.log'), 'a');
    
    // 启动进程
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonCmd, [agentScript], {
      cwd: hermesDir,
      env,
      stdio: ['ignore', stdout, stderr],
      detached: false,
      windowsHide: true
    });
    
    child.on('error', (err) => {
      console.error(chalk.red(`Hermes 启动失败: ${err.message}`));
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`Hermes 异常退出，代码: ${code}`));
      }
    });
    
    this.processes.hermes = child;
    
    // 保存 PID
    this.saveRuntimeMeta('hermes', {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      port
    });
    
    console.log(chalk.green(`   Hermes 已启动 (PID: ${child.pid})`));
    
    return child;
  }
  
  /**
   * 启动 OpenClaw
   */
  async startOpenClaw(config) {
    const port = config.websocketPort || 8765;
    const openclawDir = path.join(__dirname, '..', 'openclaw');
    const indexScript = path.join(openclawDir, 'index.js');
    
    // 检查 node_modules
    const nodeModules = path.join(openclawDir, 'node_modules');
    if (!fs.existsSync(nodeModules)) {
      console.log(chalk.yellow('   首次启动，安装 OpenClaw 依赖...'));
      await this.runCommand('npm', ['install'], { cwd: openclawDir });
    }
    
    // 构建环境变量
    const env = {
      ...process.env,
      CLAWMIND_DIR: this.configManager.getDataDir(),
      CLAWMIND_OPENCLAW_DIR: path.join(this.configManager.getDataDir(), 'openclaw'),
      CLAWMIND_WEBSOCKET_URL: `ws://localhost:${port}`,
      CLAWMIND_API_KEY: config.apiKey
    };
    
    // 日志文件
    const logDir = path.join(this.configManager.getDataDir(), 'logs', 'openclaw');
    fs.mkdirSync(logDir, { recursive: true });
    const stdout = fs.openSync(path.join(logDir, 'stdout.log'), 'a');
    const stderr = fs.openSync(path.join(logDir, 'stderr.log'), 'a');
    
    // 启动进程
    const child = spawn('node', [indexScript], {
      cwd: openclawDir,
      env,
      stdio: ['ignore', stdout, stderr],
      detached: false,
      windowsHide: true
    });
    
    child.on('error', (err) => {
      console.error(chalk.red(`OpenClaw 启动失败: ${err.message}`));
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        console.error(chalk.red(`OpenClaw 异常退出，代码: ${code}`));
      }
    });
    
    this.processes.openclaw = child;
    
    // 保存 PID
    this.saveRuntimeMeta('openclaw', {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      port
    });
    
    console.log(chalk.green(`   OpenClaw 已启动 (PID: ${child.pid})`));
    
    return child;
  }
  
  /**
   * 停止所有进程
   */
  async stopAll() {
    const pids = [
      this.readRuntimeMeta('hermes')?.pid,
      this.readRuntimeMeta('openclaw')?.pid
    ].filter(Boolean);
    
    for (const pid of pids) {
      try {
        if (process.platform === 'win32') {
          await this.runCommand('taskkill', ['/PID', String(pid), '/F']);
        } else {
          process.kill(pid, 'SIGTERM');
        }
        console.log(chalk.gray(`   已停止进程 ${pid}`));
      } catch (err) {
        // 忽略错误
      }
    }
    
    this.clearRuntimeMeta('hermes');
    this.clearRuntimeMeta('openclaw');
  }
  
  // 辅助方法
  saveRuntimeMeta(name, data) { /* ... */ }
  readRuntimeMeta(name) { /* ... */ }
  clearRuntimeMeta(name) { /* ... */ }
  runCommand(cmd, args, opts) { /* ... */ }
}

module.exports = Launcher;
```

#### 4.1.3 core/doctor.js - 诊断修复

```javascript
/**
 * ClawMind Core - 诊断与修复
 * 
 * 检查范围：
 * 1. Python 环境
 * 2. Node.js 环境
 * 3. pip/npm 依赖
 * 4. API Key 配置
 * 5. 端口可用性
 * 6. 数据目录权限
 * 7. Hermes Agent 安装
 * 8. OpenClaw 安装
 */

const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const os = require('os');

class Doctor {
  constructor(configManager) {
    this.configManager = configManager;
    this.results = [];
  }
  
  /**
   * 运行完整诊断
   */
  async runFull() {
    this.results = [];
    
    await this.checkPython();
    await this.checkNode();
    await this.checkPip();
    await this.checkNpm();
    await this.checkHermesAgent();
    await this.checkOpenClaw();
    await this.checkConfig();
    await this.checkPort();
    await this.checkDataDir();
    await this.checkDiskSpace();
    
    return this.results;
  }
  
  /**
   * Python 环境检查
   */
  async checkPython() {
    try {
      const version = execSync('python --version', { encoding: 'utf-8' }).trim();
      const match = version.match(/Python (\d+)\.(\d+)/);
      
      if (match && parseInt(match[1]) >= 3 && parseInt(match[2]) >= 10) {
        this.results.push({
          name: 'Python 环境',
          status: 'pass',
          message: version
        });
      } else {
        this.results.push({
          name: 'Python 环境',
          status: 'warn',
          message: `${version} (建议 Python 3.10+)`
        });
      }
    } catch (err) {
      this.results.push({
        name: 'Python 环境',
        status: 'fail',
        message: 'Python 未安装或不在 PATH 中'
      });
    }
  }
  
  /**
   * Node.js 环境检查
   */
  async checkNode() {
    try {
      const version = execSync('node --version', { encoding: 'utf-8' }).trim();
      const match = version.match(/v(\d+)\.(\d+)/);
      
      if (match && parseInt(match[1]) >= 18) {
        this.results.push({
          name: 'Node.js 环境',
          status: 'pass',
          message: version
        });
      } else {
        this.results.push({
          name: 'Node.js 环境',
          status: 'warn',
          message: `${version} (建议 Node.js 18+)`
        });
      }
    } catch (err) {
      this.results.push({
        name: 'Node.js 环境',
        status: 'fail',
        message: 'Node.js 未安装或不在 PATH 中'
      });
    }
  }
  
  /**
   * Hermes Agent 安装检查
   */
  async checkHermesAgent() {
    try {
      const output = execSync('pip show hermes-agent', { encoding: 'utf-8' });
      const version = output.match(/Version: ([\d.]+)/);
      
      this.results.push({
        name: 'Hermes Agent',
        status: 'pass',
        message: `已安装 v${version ? version[1] : 'unknown'}`
      });
    } catch {
      this.results.push({
        name: 'Hermes Agent',
        status: 'fail',
        message: '未安装 (运行: pip install hermes-agent)'
      });
    }
  }
  
  /**
   * OpenClaw 安装检查
   */
  async checkOpenClaw() {
    const openclawDir = path.join(__dirname, '..', 'openclaw');
    const nodeModules = path.join(openclawDir, 'node_modules');
    
    // 检查 package.json
    const packageJson = path.join(openclawDir, 'package.json');
    if (!fs.existsSync(packageJson)) {
      this.results.push({
        name: 'OpenClaw',
        status: 'fail',
        message: 'package.json 不存在'
      });
      return;
    }
    
    // 检查 node_modules
    if (!fs.existsSync(nodeModules)) {
      this.results.push({
        name: 'OpenClaw',
        status: 'warn',
        message: '依赖未安装 (运行: cd openclaw && npm install)'
      });
    } else {
      // 检查关键依赖
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
      const deps = Object.keys(pkg.dependencies || {});
      
      this.results.push({
        name: 'OpenClaw',
        status: 'pass',
        message: `已安装 ${deps.length} 个依赖`
      });
    }
  }
  
  /**
   * 端口检查
   */
  async checkPort() {
    const port = this.configManager.loadConfig().websocketPort || 8765;
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        this.results.push({
          name: `端口 ${port}`,
          status: 'fail',
          message: '端口已被占用'
        });
        resolve();
      });
      
      server.once('listening', () => {
        server.close();
        this.results.push({
          name: `端口 ${port}`,
          status: 'pass',
          message: '可用'
        });
        resolve();
      });
      
      server.listen(port, '127.0.0.1');
    });
  }
  
  /**
   * 自动修复
   */
  async fixAll(results) {
    const failed = results.filter(r => r.status === 'fail');
    
    for (const check of failed) {
      await this.fix(check);
    }
  }
  
  async fix(check) {
    switch (check.name) {
      case 'Hermes Agent':
        console.log(chalk.blue(`   安装 Hermes Agent...`));
        try {
          execSync('pip install hermes-agent', { stdio: 'inherit' });
          console.log(chalk.green('   ✓ Hermes Agent 安装成功'));
        } catch (err) {
          console.log(chalk.red(`   ✗ Hermes Agent 安装失败`));
        }
        break;
        
      case 'OpenClaw':
        const openclawDir = path.join(__dirname, '..', 'openclaw');
        console.log(chalk.blue(`   安装 OpenClaw 依赖...`));
        try {
          execSync('npm install', { cwd: openclawDir, stdio: 'inherit' });
          console.log(chalk.green('   ✓ OpenClaw 依赖安装成功'));
        } catch (err) {
          console.log(chalk.red(`   ✗ OpenClaw 依赖安装失败`));
        }
        break;
        
      // ... 其他修复逻辑
    }
  }
}

module.exports = Doctor;
```

### 4.2 Hermes Agent 扩展层

#### 4.2.1 hermes/agent.py - 主入口

```python
"""
ClawMind Hermes Agent - 主入口

这是一个 ClawMind 专用的 Hermes Agent 扩展类
继承自官方 hermes-agent 框架
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional

from hermes import HermesAgent
from hermes.memory import MemoryDB
from hermes.strategies import StrategyEngine

from extensions.custom_strategies import ClawMindStrategy
from extensions.memory_bridge import MemoryBridge
from extensions.skills_bridge import SkillsBridge

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ClawMind.Hermes')


class ClawMindHermes(HermesAgent):
    """
    ClawMind 专用 Hermes Agent
    
    扩展功能：
    1. 自定义思考策略
    2. 记忆系统桥接
    3. 技能系统桥接
    4. JSON 指令协议适配
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化 ClawMind Hermes
        
        Args:
            config: 配置字典
                - api_key: API 密钥
                - model: 模型名称
                - api_endpoint: API 端点
                - websocket_port: WebSocket 端口
                - memory_db: 记忆数据库路径
                - data_dir: 数据目录
        """
        self.config = config
        self.data_dir = config.get('data_dir', './data')
        
        # 初始化父类
        super().__init__(
            api_key=config['api_key'],
            model=config.get('model', 'gpt-4'),
            api_endpoint=config.get('api_endpoint', 'https://api.openai.com/v1'),
            memory_db=self._init_memory_db(),
            websocket_port=config.get('websocket_port', 8765),
            auth_header=config.get('auth_header', 'Authorization'),
            auth_prefix=config.get('auth_prefix', 'Bearer ')
        )
        
        # 初始化扩展
        self._init_extensions()
        
        logger.info('ClawMind Hermes Agent 初始化完成')
    
    def _init_memory_db(self) -> str:
        """初始化记忆数据库"""
        memory_dir = os.path.join(self.data_dir, 'memory')
        os.makedirs(memory_dir, exist_ok=True)
        return os.path.join(memory_dir, 'hermes.db')
    
    def _init_extensions(self):
        """初始化扩展模块"""
        # 记忆桥接
        self.memory_bridge = MemoryBridge(
            memory_db=self.memory_db,
            clawmind_data_dir=self.data_dir
        )
        
        # 技能桥接
        self.skills_bridge = SkillsBridge(
            skills_dir=os.path.join(self.data_dir, 'skills')
        )
        
        # 注册自定义策略
        self.register_strategy(
            'clawmind_default',
            ClawMindStrategy(
                memory_bridge=self.memory_bridge,
                skills_bridge=self.skills_bridge
            )
        )
        
        # 注册消息处理器
        self.register_handler('task.run', self.handle_task_run)
        self.register_handler('memory.sync', self.handle_memory_sync)
        self.register_handler('skill.execute', self.handle_skill_execute)
    
    async def handle_task_run(self, websocket, message: Dict) -> Dict:
        """
        处理任务执行请求
        
        消息格式：
        {
            "type": "task.run",
            "id": "task_xxx",
            "input": "用户输入",
            "options": {
                "mode": "serial" | "batch",
                "max_steps": 8
            }
        }
        """
        task_id = message.get('id', f'task_{int(asyncio.get_event_loop().time())}')
        user_input = message.get('input', '').strip()
        options = message.get('options', {})
        
        if not user_input:
            return {
                'type': 'task.result',
                'id': task_id,
                'success': False,
                'error': 'empty_input'
            }
        
        logger.info(f'收到任务: {task_id} - {user_input}')
        
        try:
            # 使用策略引擎生成计划
            plan = await self.think(
                task=user_input,
                strategy='clawmind_default',
                context={
                    'mode': options.get('mode', 'batch'),
                    'max_steps': options.get('max_steps', 8),
                    'memory_bridge': self.memory_bridge,
                    'skills_bridge': self.skills_bridge
                }
            )
            
            # 执行计划
            result = await self.execute_plan(
                plan=plan,
                task_id=task_id,
                mode=options.get('mode', 'batch')
            )
            
            # 保存到记忆
            await self.memory_bridge.save_task_result(task_id, {
                'input': user_input,
                'plan': plan,
                'result': result
            })
            
            return {
                'type': 'task.result',
                'id': task_id,
                'success': result['success'],
                'plan': plan,
                'step_results': result.get('step_results', []),
                'failed_step': result.get('failed_step')
            }
            
        except Exception as e:
            logger.error(f'任务执行失败: {e}', exc_info=True)
            return {
                'type': 'task.result',
                'id': task_id,
                'success': False,
                'error': str(e)
            }
    
    async def handle_memory_sync(self, websocket, message: Dict) -> Dict:
        """处理记忆同步请求"""
        try:
            await self.memory_bridge.sync_from_clawmind()
            return {
                'type': 'memory.sync.result',
                'success': True
            }
        except Exception as e:
            return {
                'type': 'memory.sync.result',
                'success': False,
                'error': str(e)
            }
    
    async def handle_skill_execute(self, websocket, message: Dict) -> Dict:
        """处理技能执行请求"""
        skill_id = message.get('skill_id')
        params = message.get('params', {})
        
        try:
            result = await self.skills_bridge.execute(
                skill_id=skill_id,
                params=params,
                context=self
            )
            return {
                'type': 'skill.execute.result',
                'skill_id': skill_id,
                'success': True,
                'result': result
            }
        except Exception as e:
            return {
                'type': 'skill.execute.result',
                'skill_id': skill_id,
                'success': False,
                'error': str(e)
            }
    
    async def execute_plan(
        self, 
        plan: Dict, 
        task_id: str, 
        mode: str = 'batch'
    ) -> Dict:
        """
        执行计划
        
        Args:
            plan: 计划字典
            task_id: 任务ID
            mode: 执行模式 ('serial' | 'batch')
        """
        steps = plan.get('steps', [])
        step_results = []
        
        for i, step in enumerate(steps, 1):
            step_id = f'{task_id}:step:{i}'
            
            # 发送命令到 OpenClaw
            command = {
                'type': 'command',
                'id': step_id,
                'action': step['action'],
                'params': step.get('params', {}),
                'reason': step.get('reason', '')
            }
            
            # 发送并等待结果
            result = await self.send_command_and_wait(command)
            
            step_results.append({
                'step': i,
                'action': step['action'],
                'result': result
            })
            
            # 如果失败，根据模式决定是否继续
            if not result.get('success', False):
                if mode == 'serial':
                    return {
                        'success': False,
                        'step_results': step_results,
                        'failed_step': i
                    }
                # batch 模式继续执行
        
        return {
            'success': True,
            'step_results': step_results
        }
    
    async def send_command_and_wait(self, command: Dict, timeout: int = 60) -> Dict:
        """
        发送命令到 OpenClaw 并等待结果
        """
        future = asyncio.get_event_loop().create_future()
        self._pending_commands[command['id']] = future
        
        try:
            # 通过 WebSocket 发送
            await self.broadcast(command)
            
            # 等待结果
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
            
        except asyncio.TimeoutError:
            self._pending_commands.pop(command['id'], None)
            return {
                'success': False,
                'error': 'timeout',
                'message': f'命令执行超时 ({timeout}s)'
            }
        except Exception as e:
            return {
                'success': False,
                'error': 'exception',
                'message': str(e)
            }


def main():
    """主入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ClawMind Hermes Agent')
    parser.add_argument('--port', type=int, default=8765, help='WebSocket 端口')
    parser.add_argument('--data-dir', type=str, default='./data', help='数据目录')
    parser.add_argument('--api-key', type=str, help='API 密钥')
    parser.add_argument('--model', type=str, default='gpt-4', help='模型')
    parser.add_argument('--api-endpoint', type=str, help='API 端点')
    args = parser.parse_args()
    
    # 从环境变量或参数获取配置
    config = {
        'api_key': args.api_key or os.environ.get('CLAWMIND_API_KEY', ''),
        'model': args.model or os.environ.get('CLAWMIND_MODEL', 'gpt-4'),
        'api_endpoint': args.api_endpoint or os.environ.get('CLAWMIND_API_ENDPOINT', 'https://api.openai.com/v1'),
        'websocket_port': args.port or int(os.environ.get('CLAWMIND_WEBSOCKET_PORT', 8765)),
        'data_dir': args.data_dir or os.environ.get('CLAWMIND_DIR', './data'),
        'auth_header': os.environ.get('CLAWMIND_AUTH_HEADER', 'Authorization'),
        'auth_prefix': os.environ.get('CLAWMIND_AUTH_PREFIX', 'Bearer ')
    }
    
    if not config['api_key']:
        raise ValueError('API 密钥未设置，请设置 CLAWMIND_API_KEY 环境变量')
    
    # 创建并启动 Agent
    agent = ClawMindHermes(config)
    
    logger.info(f'启动 Hermes Agent，端口: {config["websocket_port"]}')
    asyncio.run(agent.start())


if __name__ == '__main__':
    main()
```

#### 4.2.2 hermes/extensions/custom_strategies.py - 自定义策略

```python
"""
ClawMind 自定义思考策略
"""

import json
from typing import Dict, Any, List


class ClawMindStrategy:
    """
    ClawMind 专用思考策略
    
    特点：
    1. 优先使用技能库中的已有技能
    2. 记忆辅助决策
    3. 危险操作检测
    4. 多步任务分解
    """
    
    SUPPORTED_ACTIONS = [
        # 文件操作
        'file.read', 'file.write', 'file.delete', 'file.list',
        'file.search', 'file.copy', 'file.move', 'file.info',
        # 终端操作
        'terminal.exec', 'terminal.exec_script', 'terminal.get_cwd',
        'terminal.set_cwd', 'terminal.get_env', 'terminal.set_env',
        # 浏览器操作
        'browser.launch', 'browser.close', 'browser.open', 'browser.click',
        'browser.input', 'browser.extract', 'browser.screenshot',
        'browser.wait_for', 'browser.evaluate', 'browser.navigate',
        # 桌面操作
        'desktop.screenshot', 'desktop.mouse_move', 'desktop.mouse_click',
        'desktop.mouse_drag', 'desktop.key_press', 'desktop.key_combo',
        'desktop.type_text', 'desktop.get_window_list',
        'desktop.focus_window', 'desktop.get_screen_size',
        'desktop.get_mouse_position',
        # 剪贴板
        'clipboard.read', 'clipboard.write', 'clipboard.clear',
        # 记忆操作
        'memory.save_conversation', 'memory.load_conversation',
        'memory.list_conversations', 'memory.save_preference',
        'memory.get_preference', 'memory.save_task', 'memory.list_tasks',
        # 技能操作
        'skill.get', 'skill.list', 'skill.execute',
        'skill.create', 'skill.search',
        # 通知
        'notification.send', 'notification.task_complete',
        'notification.error',
    ]
    
    DANGEROUS_ACTIONS = {
        'file.delete': '此操作将永久删除文件',
        'terminal.exec': '将执行系统命令',
        'desktop.mouse_click': '将控制鼠标点击',
        'desktop.key_press': '将控制键盘按键',
    }
    
    def __init__(self, memory_bridge, skills_bridge):
        self.memory = memory_bridge
        self.skills = skills_bridge
    
    async def generate_plan(
        self, 
        task: str, 
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        生成执行计划
        
        Args:
            task: 用户任务描述
            context: 上下文信息
            
        Returns:
            计划字典: {"goal": str, "steps": [List]}
        """
        # 1. 检查是否有相关技能可用
        relevant_skills = await self._find_relevant_skills(task)
        
        # 2. 检查记忆中的类似任务
        similar_tasks = await self.memory.find_similar_tasks(task)
        
        # 3. 构建提示词
        prompt = self._build_prompt(task, relevant_skills, similar_tasks)
        
        # 4. 调用 LLM 生成计划
        plan = await self._call_llm(prompt, context)
        
        # 5. 后处理：添加危险操作标记
        plan = self._mark_dangerous_steps(plan)
        
        # 6. 验证计划
        plan = self._validate_plan(plan)
        
        return plan
    
    async def _find_relevant_skills(self, task: str) -> List[Dict]:
        """查找相关技能"""
        skills = await self.skills.search(task)
        return skills[:3]  # 最多返回3个
    
    async def _find_similar_tasks(self, task: str) -> List[Dict]:
        """查找类似任务"""
        return await self.memory.find_similar_tasks(task)
    
    def _build_prompt(
        self, 
        task: str, 
        relevant_skills: List[Dict],
        similar_tasks: List[Dict]
    ) -> str:
        """构建 LLM 提示词"""
        
        skills_text = ''
        if relevant_skills:
            skills_text = '\n\n相关技能:\n'
            for skill in relevant_skills:
                skills_text += f"- {skill['name']}: {skill['description']}\n"
        
        history_text = ''
        if similar_tasks:
            history_text = '\n\n历史类似任务:\n'
            for t in similar_tasks[:2]:
                history_text += f"- {t['task']}: {t['result']}\n"
        
        return f"""你是一个严格输出 JSON 的任务计划器。

要求：
1. 只能使用允许的 action
2. 只输出 JSON，不要输出任何其他内容
3. JSON 格式必须为: {{"goal": "任务目标描述", "steps": [{{"action": "action.name", "params": {{}}, "reason": "为什么这样做"}}]}}
4. steps 数量必须在 1 到 8 步之间
5. 如果任务涉及危险操作，在 reason 中说明

允许的 action:
{', '.join(self.SUPPORTED_ACTIONS)}

{skills_text}
{history_text}

用户任务: {task}

请生成执行计划（只输出JSON）："""
    
    async def _call_llm(self, prompt: str, context: Dict) -> Dict:
        """调用 LLM"""
        # 这里调用真实的 LLM API
        # 由父类 HermesAgent 提供
        pass
    
    def _mark_dangerous_steps(self, plan: Dict) -> Dict:
        """标记危险步骤"""
        for step in plan.get('steps', []):
            action = step.get('action')
            if action in self.DANGEROUS_ACTIONS:
                step['dangerous'] = True
                step['warning'] = self.DANGEROUS_ACTIONS[action]
        return plan
    
    def _validate_plan(self, plan: Dict) -> Dict:
        """验证计划"""
        if 'goal' not in plan or 'steps' not in plan:
            raise ValueError('计划缺少必要字段')
        
        # 验证每个步骤
        valid_actions = set(self.SUPPORTED_ACTIONS)
        for i, step in enumerate(plan['steps'], 1):
            if step.get('action') not in valid_actions:
                raise ValueError(f'第 {i} 步包含不支持的 action: {step.get("action")}')
        
        return plan
```

#### 4.2.3 hermes/extensions/memory_bridge.py - 记忆桥接

```python
"""
Hermes 记忆系统与 ClawMind 的桥接

Hermes 使用 SQLite 存储记忆
ClawMind 可能使用 JSON 文件或其他格式
这个桥接层负责数据同步
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional


class MemoryBridge:
    """
    记忆桥接器
    
    职责：
    1. Hermes SQLite <-> ClawMind JSON 文件 双向同步
    2. 对话历史同步
    3. 用户偏好同步
    4. 任务历史同步
    """
    
    def __init__(self, memory_db: str, clawmind_data_dir: str):
        self.hermes_db = memory_db
        self.clawmind_data_dir = clawmind_data_dir
        
        # ClawMind 记忆目录
        self.conversations_dir = os.path.join(clawmind_data_dir, 'memory', 'conversations')
        self.preferences_file = os.path.join(clawmind_data_dir, 'memory', 'preferences.json')
        self.tasks_dir = os.path.join(clawmind_data_dir, 'memory', 'tasks')
        
        # 确保目录存在
        os.makedirs(self.conversations_dir, exist_ok=True)
        os.makedirs(self.tasks_dir, exist_ok=True)
    
    async def sync_from_clawmind(self):
        """从 ClawMind 同步到 Hermes"""
        # 同步对话历史
        await self._sync_conversations()
        
        # 同步偏好设置
        await self._sync_preferences()
        
        # 同步任务历史
        await self._sync_tasks()
    
    async def sync_to_clawmind(self):
        """从 Hermes 同步到 ClawMind"""
        # 同步对话历史
        await self._export_conversations()
        
        # 同步偏好设置
        await self._export_preferences()
    
    async def save_task_result(self, task_id: str, result: Dict):
        """保存任务结果到 Hermes"""
        # 使用 Hermes 的原生存储
        await self._save_to_hermes('task_history', {
            'task_id': task_id,
            'input': result.get('input'),
            'plan': result.get('plan'),
            'result': result.get('result'),
            'timestamp': datetime.now().isoformat()
        })
    
    async def find_similar_tasks(self, task: str, limit: int = 5) -> List[Dict]:
        """查找类似任务"""
        # 使用 Hermes 的搜索能力
        results = await self._search_hermes('task_history', task)
        return results[:limit]
    
    # --- Hermes 数据库操作 ---
    
    async def _save_to_hermes(self, table: str, data: Dict):
        """保存数据到 Hermes SQLite"""
        import aiosqlite
        
        async with aiosqlite.connect(self.hermes_db) as db:
            # 创建表（如果不存在）
            await db.execute(f'''
                CREATE TABLE IF NOT EXISTS {table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data TEXT,
                    timestamp TEXT
                )
            ''')
            
            await db.execute(
                f'INSERT INTO {table} (data, timestamp) VALUES (?, ?)',
                (json.dumps(data), datetime.now().isoformat())
            )
            
            await db.commit()
    
    async def _search_hermes(self, table: str, query: str) -> List[Dict]:
        """搜索 Hermes 数据"""
        import aiosqlite
        
        results = []
        async with aiosqlite.connect(self.hermes_db) as db:
            async with db.execute(
                f'SELECT data FROM {table} ORDER BY timestamp DESC LIMIT 50'
            ) as cursor:
                async for row in cursor:
                    data = json.loads(row[0])
                    # 简单的文本匹配
                    if query.lower() in json.dumps(data).lower():
                        results.append(data)
        
        return results
    
    # --- ClawMind 文件同步 ---
    
    async def _sync_conversations(self):
        """同步对话历史"""
        if not os.path.exists(self.conversations_dir):
            return
        
        for filename in os.listdir(self.conversations_dir):
            if not filename.endswith('.json'):
                continue
            
            filepath = os.path.join(self.conversations_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                conversation = json.load(f)
            
            await self._save_to_hermes('conversations', conversation)
    
    async def _sync_preferences(self):
        """同步偏好设置"""
        if not os.path.exists(self.preferences_file):
            return
        
        with open(self.preferences_file, 'r', encoding='utf-8') as f:
            preferences = json.load(f)
        
        await self._save_to_hermes('preferences', preferences)
    
    async def _sync_tasks(self):
        """同步任务历史"""
        if not os.path.exists(self.tasks_dir):
            return
        
        for filename in os.listdir(self.tasks_dir):
            if not filename.endswith('.json'):
                continue
            
            filepath = os.path.join(self.tasks_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                task = json.load(f)
            
            await self._save_to_hermes('tasks', task)
```

### 4.3 OpenClaw 扩展层

#### 4.3.1 openclaw/index.js - 主入口

```javascript
/**
 * ClawMind OpenClaw - 主入口
 * 
 * 这是一个 ClawMind 专用的 OpenClaw 扩展
 * 继承自官方 @openclaw/core 框架
 */

const { OpenClaw } = require('@openclaw/core');
const { 
  FileTools, 
  TerminalTools, 
  BrowserTools,
  DesktopTools,
  ClipboardTools,
  HttpTools
} = require('@openclaw/tools');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

class ClawMindOpenClaw extends OpenClaw {
  /**
   * @param {Object} config 配置
   * @param {string} config.hermesUrl Hermes WebSocket 地址
   * @param {string} config.dataDir ClawMind 数据目录
   * @param {Object} config.security 安全配置
   */
  constructor(config = {}) {
    super({
      hermesUrl: config.hermesUrl || process.env.CLAWMIND_WEBSOCKET_URL || 'ws://localhost:8765',
      autoReconnect: true,
      reconnectInterval: 5000,
      reconnectMaxAttempts: 10,
      requestTimeout: config.requestTimeout || 60000,
      heartbeatInterval: 30000
    });
    
    this.config = config;
    this.dataDir = config.dataDir || process.env.CLAWMIND_OPENCLAW_DIR || './data';
    this.security = config.security || {};
    
    // 事件发射器
    this.events = new EventEmitter();
    
    // 命令日志
    this.commandLog = [];
    
    // 初始化
    this._init();
  }
  
  _init() {
    // 注册工具
    this._registerTools();
    
    // 注册自定义 Skills
    this._loadCustomSkills();
    
    // 注册命令拦截器
    this._registerInterceptors();
    
    // 注册事件处理
    this._registerEventHandlers();
  }
  
  _registerTools() {
    // 文件操作工具
    const fileTools = new FileTools({
      // 安全配置
      allowedPaths: this.security.allowedPaths || [
        'C:/Users',
        process.env.HOME,
        path.join(process.env.HOME, 'Desktop'),
        path.join(process.env.HOME, 'Documents')
      ],
      deniedPaths: this.security.deniedPaths || [
        'C:/Windows',
        'C:/Program Files',
        '/usr/bin',
        '/usr/local/bin'
      ],
      maxFileSize: this.security.maxFileSize || 100 * 1024 * 1024, // 100MB
      extensions: {
        '.js': true,
        '.py': true,
        '.json': true,
        '.txt': true,
        '.md': true,
        '.csv': true,
        '.xml': true
      }
    });
    this.registerTool(fileTools);
    
    // 终端操作工具
    const terminalTools = new TerminalTools({
      allowedCommands: this.security.allowedCommands || [
        'python', 'python3', 'node', 'npm', 'git',
        'dir', 'type', 'copy', 'move', 'del',
        'ls', 'cat', 'cp', 'mv', 'rm'
      ],
      deniedCommands: [
        'rm -rf /', 'format', 'del /f /s /q',
        'shutdown', 'restart'
      ],
      timeout: 60000,
      cwd: this.dataDir
    });
    this.registerTool(terminalTools);
    
    // 浏览器工具
    const browserTools = new BrowserTools({
      headless: false,
      userDataDir: path.join(this.dataDir, 'browser', 'userdata'),
      screenshotsDir: path.join(this.dataDir, 'screenshots'),
      downloadPath: path.join(this.dataDir, 'downloads'),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    this.registerTool(browserTools);
    
    // 桌面控制工具
    const desktopTools = new DesktopTools({
      screenshotDir: path.join(this.dataDir, 'screenshots'),
      confidence: 0.9,
      pause: 0.1
    });
    this.registerTool(desktopTools);
    
    // 剪贴板工具
    const clipboardTools = new ClipboardTools();
    this.registerTool(clipboardTools);
    
    // HTTP 工具
    const httpTools = new HttpTools({
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'ClawMind/5.0.0'
      }
    });
    this.registerTool(httpTools);
    
    console.log('[OpenClaw] 工具注册完成');
  }
  
  _loadCustomSkills() {
    const skillsDir = path.join(__dirname, 'skills', 'custom');
    
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
      return;
    }
    
    const skillFiles = fs.readdirSync(skillsDir)
      .filter(f => f.endsWith('.json') || f.endsWith('.md'));
    
    for (const file of skillFiles) {
      const filepath = path.join(skillsDir, file);
      try {
        this.loadSkill(filepath);
        console.log(`[OpenClaw] 加载技能: ${file}`);
      } catch (err) {
        console.error(`[OpenClaw] 技能加载失败: ${file}`, err.message);
      }
    }
  }
  
  _registerInterceptors() {
    // 命令执行前拦截
    this.onBeforeExecute((action, params) => {
      // 记录日志
      this.commandLog.push({
        action,
        params,
        timestamp: new Date().toISOString()
      });
      
      // 危险操作检查
      if (this._isDangerousAction(action)) {
        console.warn(`[OpenClaw] 危险操作: ${action}`, params);
      }
      
      // 发出事件
      this.events.emit('command:before', { action, params });
    });
    
    // 命令执行后拦截
    this.onAfterExecute((action, params, result) => {
      this.events.emit('command:after', { action, params, result });
    });
  }
  
  _registerEventHandlers() {
    // 处理 Hermes 发来的命令
    this.onMessage(async (message) => {
      const { type, id, action, params } = message;
      
      switch (type) {
        case 'command':
          // 执行命令
          const result = await this.execute(action, params);
          
          // 发送结果回 Hermes
          this.send({
            type: 'command_result',
            id,
            success: result.success,
            result: result.data,
            error: result.error
          });
          break;
          
        case 'ping':
          this.send({ type: 'pong', id });
          break;
          
        default:
          console.log('[OpenClaw] 未知消息类型:', type);
      }
    });
    
    // 连接成功
    this.onConnect(() => {
      console.log('[OpenClaw] 已连接到 Hermes');
      
      // 注册自己
      this.send({
        type: 'register',
        client: 'openclaw',
        capabilities: this.getCapabilities()
      });
    });
    
    // 连接断开
    this.onDisconnect(() => {
      console.log('[OpenClaw] 与 Hermes 断开连接');
    });
    
    // 连接错误
    this.onError((err) => {
      console.error('[OpenClaw] 连接错误:', err.message);
    });
  }
  
  _isDangerousAction(action) {
    const dangerousActions = [
      'file.delete',
      'file.move',
      'terminal.exec',
      'desktop.mouse_click',
      'desktop.key_press',
      'desktop.key_combo'
    ];
    return dangerousActions.includes(action);
  }
  
  /**
   * 获取能力列表
   */
  getCapabilities() {
    return {
      tools: this.tools.map(t => t.name),
      skills: this.skills.map(s => s.id),
      version: '5.0.0'
    };
  }
  
  /**
   * 执行命令
   */
  async execute(action, params) {
    const startTime = Date.now();
    
    try {
      const result = await super.execute(action, params);
      
      return {
        success: true,
        data: result,
        duration: Date.now() - startTime
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: err.code || 'EXECUTION_ERROR',
          message: err.message
        },
        duration: Date.now() - startTime
      };
    }
  }
}

// 主入口
async function main() {
  const config = {
    hermesUrl: process.env.CLAWMIND_WEBSOCKET_URL || 'ws://localhost:8765',
    dataDir: process.env.CLAWMIND_OPENCLAW_DIR || './data',
    security: {
      allowedPaths: [
        process.env.HOME || 'C:/Users',
        'C:/Users/14127/Desktop'
      ],
      allowedCommands: ['python', 'node', 'git', 'npm']
    }
  };
  
  console.log('[OpenClaw] 启动...');
  console.log('[OpenClaw] Hermes URL:', config.hermesUrl);
  console.log('[OpenClaw] 数据目录:', config.dataDir);
  
  const openclaw = new ClawMindOpenClaw(config);
  
  // 连接 Hermes
  await openclaw.connect();
  
  console.log('[OpenClaw] 已就绪');
  
  // 保持运行
  process.on('SIGINT', async () => {
    console.log('[OpenClaw] 关闭中...');
    await openclaw.disconnect();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ClawMindOpenClaw;
```

---

## 五、环境安装（一键安装）

> **目标**：在任何 Windows 系统上，双击安装包或运行一个脚本，就能自动完成所有环境配置，无需手动安装 Node.js、Python 等依赖。

### 5.1 完整的一键安装流程

```batch
@echo off
setlocal enabledelayedexpansion

::==========================================
::  ClawMind 5.0 一键安装脚本
::  自动安装：Node.js + Python + 所有依赖
::==========================================

set "SCRIPT_DIR=%~dp0"
set "CLAWMIND_DIR=%USERPROFILE%\ClawMind"
set "INSTALL_LOG=%USERPROFILE%\clawmind_install.log"

:: 记录日志
call :log "=========================================="
call :log "ClawMind 5.0 一键安装开始"
call :log "时间: %date% %time%"
call :log "=========================================="

::========== 步骤 1: 检查并安装 Node.js ==========
call :check_node

::========== 步骤 2: 检查并安装 Python ==========
call :check_python

::========== 步骤 3: 创建目录结构 ==========
call :create_dirs

::========== 步骤 4: 安装 Python 依赖 ==========
call :install_python_deps

::========== 步骤 5: 安装 Node.js 依赖 ==========
call :install_node_deps

::========== 步骤 6: 生成配置文件 ==========
call :generate_config

::========== 步骤 7: 下载浏览器驱动 ==========
call :install_browser_drivers

::========== 完成 ==========
call :log "安装完成！"
goto :success

::==========================================
::  子程序
::==========================================

:check_node
call :log "[1/7] 检查 Node.js..."

node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
    call :log "  已安装 Node.js !NODE_VER!"
    exit /b 0
)

call :log "  Node.js 未安装，开始下载..."

:: 下载 Node.js LTS
set "NODE_URL=https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
set "NODE_MSI=%TEMP%\node-v20.11.0-x64.msi"

call :log "  下载 Node.js from !NODE_URL!"
powershell -Command "& {Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_MSI!'}"

call :log "  安装 Node.js..."
msiexec /i "!NODE_MSI!" /quiet /norestart

:: 等待安装完成
timeout /t 10 /nobreak >nul

:: 刷新环境变量
set "PATH=%PATH%;C:\Program Files\nodejs\;C:\Program Files (x86)\npm\"

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
call :log "  Node.js !NODE_VER! 安装完成"

:: 清理安装包
del "!NODE_MSI!" 2>nul

exit /b 0

:check_python
call :log "[2/7] 检查 Python..."

python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%v in ('python --version') do set "PY_VER=%%v"
    call :log "  已安装 Python !PY_VER!"
    exit /b 0
)

call :log "  Python 未安装，开始下载..."

:: 下载 Python 3.11
set "PY_URL=https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe"
set "PY_EXE=%TEMP%\python-3.11.7-amd64.exe"

call :log "  下载 Python from !PY_URL!"
powershell -Command "& {Invoke-WebRequest -Uri '!PY_URL!' -OutFile '!PY_EXE!'}"

call :log "  安装 Python..."
!PY_EXE! /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

:: 等待安装完成
timeout /t 15 /nobreak >nul

:: 刷新环境变量
set "PATH=%PATH%;C:\Program Files\Python311\;C:\Program Files\Python311\Scripts\"

for /f "delims=" %%v in ('python --version') do set "PY_VER=%%v"
call :log "  Python !PY_VER! 安装完成"

:: 升级 pip
python -m pip install --upgrade pip --quiet

:: 清理安装包
del "!PY_EXE!" 2>nul

exit /b 0

:create_dirs
call :log "[3/7] 创建目录结构..."

if not exist "!CLAWMIND_DIR!" mkdir "!CLAWMIND_DIR!"
if not exist "!CLAWMIND_DIR!\logs" mkdir "!CLAWMIND_DIR!\logs"
if not exist "!CLAWMIND_DIR!\logs\hermes" mkdir "!CLAWMIND_DIR!\logs\hermes"
if not exist "!CLAWMIND_DIR!\logs\openclaw" mkdir "!CLAWMIND_DIR!\logs\openclaw"
if not exist "!CLAWMIND_DIR!\memory" mkdir "!CLAWMIND_DIR!\memory"
if not exist "!CLAWMIND_DIR!\runtime" mkdir "!CLAWMIND_DIR!\runtime"
if not exist "!CLAWMIND_DIR!\screenshots" mkdir "!CLAWMIND_DIR!\screenshots"
if not exist "!CLAWMIND_DIR!\downloads" mkdir "!CLAWMIND_DIR!\downloads"
if not exist "!CLAWMIND_DIR!\browser" mkdir "!CLAWMIND_DIR!\browser"

call :log "  目录创建完成: !CLAWMIND_DIR!"
exit /b 0

:install_python_deps
call :log "[4/7] 安装 Python 依赖..."

cd /d "%SCRIPT_DIR%"

:: 安装核心依赖
call :log "  安装 websockets..."
python -m pip install websockets --quiet --no-warn-script-location

call :log "  安装 pyautogui..."
python -m pip install pyautogui --quiet --no-warn-script-location

call :log "  安装 pillow..."
python -m pip install pillow --quiet --no-warn-script-location

call :log "  安装 hermes-agent..."
python -m pip install hermes-agent --quiet --no-warn-script-location

call :log "  安装 aiosqlite..."
python -m pip install aiosqlite --quiet --no-warn-script-location

call :log "  Python 依赖安装完成"
exit /b 0

:install_node_deps
call :log "[5/7] 安装 Node.js 依赖..."

cd /d "%SCRIPT_DIR%"

:: 安装根目录依赖
if exist package.json (
    call :log "  安装根目录 npm 包..."
    npm install --silent
)

:: 安装 CLI 依赖
if exist "cli\package.json" (
    call :log "  安装 CLI npm 包..."
    cd cli
    call npm install --silent
    cd /d "%SCRIPT_DIR%"
)

:: 安装 OpenClaw 依赖
if exist "openclaw\package.json" (
    call :log "  安装 OpenClaw npm 包..."
    cd openclaw
    call npm install --silent
    cd /d "%SCRIPT_DIR%"
)

:: 安装桌面 UI 依赖
if exist "desktop\package.json" (
    call :log "  安装桌面 UI npm 包..."
    cd desktop
    call npm install --silent
    cd /d "%SCRIPT_DIR%"
)

call :log "  Node.js 依赖安装完成"
exit /b 0

:generate_config
call :log "[6/7] 生成配置文件..."

set "CONFIG_FILE=!CLAWMIND_DIR!\config.json"

(
    echo {
    echo   "version": "5.0.0",
    echo   "websocketPort": 8765,
    echo   "dataDir": "!CLAWMIND_DIR!",
    echo   "model": {
    echo     "provider": "openai",
    echo     "model": "gpt-4",
    echo     "apiEndpoint": "https://api.openai.com/v1",
    echo     "apiKey": "YOUR_API_KEY_HERE",
    echo     "authHeaderName": "Authorization",
    echo     "authHeaderValuePrefix": "Bearer "
    echo   },
    echo   "execution": {
    echo     "mode": "serial",
    echo     "maxSteps": 8,
    echo     "timeout": 60
    echo   },
    echo   "security": {
    echo     "allowedPaths": ["C:\\Users"],
    echo     "deniedPaths": ["C:\\Windows", "C:\\Program Files"],
    echo     "allowedCommands": ["python", "node", "git", "npm"]
    echo   },
    echo   "language": "zh"
    echo }
) > "!CONFIG_FILE!"

call :log "  配置文件已生成: !CONFIG_FILE!"
call :log "  请编辑配置文件设置 API Key"
exit /b 0

:install_browser_drivers
call :log "[7/7] 安装浏览器驱动..."

:: Puppeteer 会在首次运行时自动下载 Chrome
call :log "  Puppeteer 将在首次运行时自动下载 Chrome"
call :log "  如果需要手动下载，请访问: https://developer.chrome.com/docs/puppeteer/get-started/"

:: 安装 Chromium（可选，用于无头模式）
:: npx puppeteer browsers install chrome

exit /b 0

:log
set "MSG=%~1"
echo [%date% %time%] !MSG!
echo [%date% %time%] !MSG! >> "!INSTALL_LOG!"
exit /b 0

:success
echo.
echo ==========================================
echo   ClawMind 5.0 安装成功！
echo ==========================================
echo.
echo   安装目录: !CLAWMIND_DIR!
echo   配置文件: !CLAWMIND_DIR!\config.json
echo.
echo   下一步：
echo   1. 编辑配置文件设置 API Key:
echo      notepad !CLAWMIND_DIR!\config.json
echo.
echo   2. 运行诊断:
echo      node core\index.js doctor
echo.
echo   3. 启动 ClawMind:
echo      node core\index.js start
echo.
echo   详细日志: !INSTALL_LOG!
echo.
pause
```

### 5.2 离线安装包制作方案

如果目标机器没有网络，需要提前打包离线安装包：

#### 5.2.1 目录结构

```
clawmind-offline/
├── install.bat              # 一键安装脚本
├── node-v20.11.0-x64.msi  # Node.js 安装包
├── python-3.11.7-amd64.exe # Python 安装包
├── node_modules.zip        # npm 依赖（可选）
└── python_packages/        # pip 离线包
    ├── websockets/
    ├── pyautogui/
    ├── pillow/
    ├── hermes_agent/
    └── aiosqlite/
```

#### 5.2.2 下载离线包脚本

```batch
@echo off
set "OUT_DIR=clawmind-offline"
mkdir "%OUT_DIR%"
mkdir "%OUT_DIR%\python_packages"

:: 下载 Node.js
powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'clawmind-offline\node-v20.11.0-x64.msi'}"

:: 下载 Python
powershell -Command "& {Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-amd64.exe' -OutFile 'clawmind-offline\python-3.11.7-amd64.exe'}"

:: 预下载 pip 包
python -m pip download websockets -d "%OUT_DIR%\python_packages"
python -m pip download pyautogui -d "%OUT_DIR%\python_packages"
python -m pip download pillow -d "%OUT_DIR%\python_packages"
python -m pip download hermes-agent -d "%OUT_DIR%\python_packages"
python -m pip download aiosqlite -d "%OUT_DIR%\python_packages"

echo 离线包下载完成！
```

### 5.3 安装后自动验证脚本

```batch
@echo off
:: install-verify.bat - 安装后验证

set "FAIL_COUNT=0"

echo.
echo ==========================================
echo   ClawMind 安装验证
echo ==========================================
echo.

:: 检查 Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js: 
    node --version
) else (
    echo [FAIL] Node.js 未安装或未添加到 PATH
    set /a FAIL_COUNT+=1
)

:: 检查 npm
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] npm: 
    npm --version
) else (
    echo [FAIL] npm 未安装
    set /a FAIL_COUNT+=1
)

:: 检查 Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python: 
    python --version
) else (
    echo [FAIL] Python 未安装
    set /a FAIL_COUNT+=1
)

:: 检查 pip
python -m pip --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] pip: 
    python -m pip --version
) else (
    echo [FAIL] pip 未安装
    set /a FAIL_COUNT+=1
)

:: 检查关键 Python 包
python -c "import websockets" 2>nul
if %errorlevel% equ 0 (
    echo [OK] websockets
) else (
    echo [FAIL] websockets 未安装
    set /a FAIL_COUNT+=1
)

python -c "import pyautogui" 2>nul
if %errorlevel% equ 0 (
    echo [OK] pyautogui
) else (
    echo [FAIL] pyautogui 未安装
    set /a FAIL_COUNT+=1
)

:: 检查数据目录
if exist "%USERPROFILE%\ClawMind\config.json" (
    echo [OK] ClawMind 配置已生成
) else (
    echo [FAIL] ClawMind 配置不存在
    set /a FAIL_COUNT+=1
)

:: 检查 node_modules
if exist "node_modules" (
    echo [OK] Node.js 依赖已安装
) else (
    echo [FAIL] Node.js 依赖未安装
    set /a FAIL_COUNT+=1
)

echo.
if %FAIL_COUNT% equ 0 (
    echo ==========================================
    echo   验证通过！可以开始使用 ClawMind
    echo ==========================================
) else (
    echo ==========================================
    echo   验证失败！有 %FAIL_COUNT% 项检查未通过
    echo ==========================================
    echo.
    echo   请运行修复脚本或手动安装缺失的组件
)
```

### 5.4 修复脚本（自动修复常见问题）

```batch
@echo off
:: install-fix.bat - 自动修复脚本

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo   ClawMind 自动修复
echo ==========================================
echo.

:: 修复 1: 刷新环境变量
echo [修复 1] 刷新环境变量...
set "PATH=C:\Program Files\nodejs;C:\Program Files (x86)\npm;C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"

:: 修复 2: 重新安装 npm 依赖
echo [修复 2] 重新安装 Node.js 依赖...
if exist package.json (
    rd /s /q node_modules 2>nul
    npm install
)

:: 修复 3: 重新安装 pip 依赖
echo [修复 3] 重新安装 Python 依赖...
python -m pip install --upgrade pip
python -m pip install websockets pyautogui pillow hermes-agent aiosqlite

:: 修复 4: 修复配置文件
echo [修复 4] 修复配置文件...
set "CONFIG=%USERPROFILE%\ClawMind\config.json"
if not exist "%CONFIG%" (
    (
        echo {
        echo   "version": "5.0.0",
        echo   "websocketPort": 8765,
        echo   "dataDir": "%USERPROFILE%\ClawMind",
        echo   "model": {
        echo     "provider": "openai",
        echo     "model": "gpt-4",
        echo     "apiEndpoint": "https://api.openai.com/v1",
        echo     "apiKey": "YOUR_API_KEY_HERE",
        echo     "authHeaderName": "Authorization",
        echo     "authHeaderValuePrefix": "Bearer "
        echo   }
    ) > "%CONFIG%"
    echo   配置文件已重新生成
)

:: 修复 5: 创建目录
echo [修复 5] 创建运行时目录...
md "%USERPROFILE%\ClawMind\logs\hermes" 2>nul
md "%USERPROFILE%\ClawMind\logs\openclaw" 2>nul
md "%USERPROFILE%\ClawMind\runtime" 2>nul
md "%USERPROFILE%\ClawMind\memory" 2>nul
md "%USERPROFILE%\ClawMind\screenshots" 2>nul

echo.
echo ==========================================
echo   修复完成！
echo ==========================================
echo.
echo   请重新运行:
echo   1. node core\index.js doctor
echo   2. node core\index.js start
echo.
pause
```

### 5.5 便携版制作（无需安装，直接运行）

#### 5.5.1 目录结构

```
clawmind-portable/
├── ClawMind.exe              # 启动器
├── config/
│   └── config.json          # 便携配置
├── data/
│   └── memory/              # 数据目录
├── logs/                    # 日志
├── node/                    # Node.js 便携版
│   ├── node.exe
│   └── node_modules/
├── python/                  # Python 便携版
│   ├── python.exe
│   └── Scripts/
├── hermes/
├── openclaw/
├── desktop/
├── scripts/
│   ├── start.bat            # 启动脚本
│   └── install-deps.bat     # 依赖安装
└── README.txt
```

#### 5.5.2 启动器源码 (ClawMind.cpp 或 ClawMind.c)

```cpp
// ClawMind.exe - 便携启动器
// 使用 C/C++ 或 Go 编译，可选

#include <windows.h>
#include <stdio.h>

int main() {
    // 设置工作目录
    char exePath[MAX_PATH];
    GetModuleFileName(NULL, exePath, MAX_PATH);
    *strrchr(exePath, '\\') = 0;
    SetCurrentDirectory(exePath);
    
    // 设置 PATH
    char nodePath[MAX_PATH], pythonPath[MAX_PATH];
    sprintf(nodePath, "%s\\node", exePath);
    sprintf(pythonPath, "%s\\python", exePath);
    
    char newPath[MAX_PATH * 2];
    sprintf(newPath, "%s;%s;%s\\Scripts", 
            getenv("PATH"), nodePath, pythonPath);
    SetEnvironmentVariable("PATH", newPath);
    
    // 设置数据目录
    SetEnvironmentVariable("CLAWMIND_DIR", exePath);
    
    // 启动 Node.js 主程序
    ShellExecute(NULL, "open", "node", "core\\index.js start", exePath, SW_SHOW);
    
    return 0;
}
```

### 5.6 各环境依赖清单

| 组件 | 必需 | 版本要求 | 安装方式 | 离线可用 |
|------|------|----------|----------|----------|
| Node.js | ✅ | ≥18.0.0 | 自动下载 MSI | ✅ |
| npm | ✅ | 内置 | Node.js 自带 | ✅ |
| Python | ✅ | ≥3.10 | 自动下载 EXE | ✅ |
| pip | ✅ | 内置 | Python 自带 | ✅ |
| websockets | ✅ | ≥12.0 | pip install | ⚠️ 需预下载 |
| pyautogui | ✅ | ≥0.9.54 | pip install | ⚠️ 需预下载 |
| pillow | ✅ | ≥10.0 | pip install | ⚠️ 需预下载 |
| hermes-agent | ✅ | ≥1.0.0 | pip install | ⚠️ 需预下载 |
| aiosqlite | ✅ | ≥0.19.0 | pip install | ⚠️ 需预下载 |
| Puppeteer | ✅ | ≥21.0 | npm install | ❌ 自动下载 |
| clipboardy | ✅ | ≥4.0 | npm install | ✅ |
| node-notifier | ✅ | ≥10.0 | npm install | ✅ |
| ws (WebSocket) | ✅ | ≥8.16 | npm install | ✅ |
| Chrome/Chromium | 可选 | 最新 | Puppeteer 自动 | ❌ 自动下载 |
| Git | 可选 | 任意 | - | - |
| VS Code | 可选 | 任意 | - | - |

---

## 六、安装脚本

### 6.1 setup.bat（Windows 一键安装）

```batch
@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   ClawMind 5.0 安装脚本
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 建议以管理员身份运行此脚本
    echo.
)

:: 设置变量
set "PROJECT_DIR=%~dp0"
set "CLAWMIND_DIR=%USERPROFILE%\ClawMind"
set "PYTHON_CMD=python"
set "NODE_CMD=node"
set "NPM_CMD=npm"

echo [1/6] 检查环境...
echo.

:: 检查 Python
!PYTHON_CMD! --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Python 未安装或不在 PATH 中
    echo 请从 https://www.python.org/downloads/ 安装 Python 3.10+
    pause
    exit /b 1
)
for /f "delims=" %%v in ('!PYTHON_CMD! --version 2^>^&1') do set "PY_VERSION=%%v"
echo     !PY_VERSION!

:: 检查 Node.js
!NODE_CMD! --version >nul 2>&1
if errorlevel 1 (
    echo [错误] Node.js 未安装或不在 PATH 中
    echo 请从 https://nodejs.org/ 安装 Node.js 18+
    pause
    exit /b 1
)
for /f "delims=" %%v in ('!NODE_CMD! --version 2^>^&1') do set "NODE_VERSION=%%v"
echo     !NODE_VERSION!

echo.
echo [2/6] 创建数据目录...
echo.
if not exist "!CLAWMIND_DIR!" mkdir "!CLAWMIND_DIR!"
if not exist "!CLAWMIND_DIR!\logs" mkdir "!CLAWMIND_DIR!\logs"
if not exist "!CLAWMIND_DIR!\memory" mkdir "!CLAWMIND_DIR!\memory"
if not exist "!CLAWMIND_DIR!\runtime" mkdir "!CLAWMIND_DIR!\runtime"
echo     数据目录: !CLAWMIND_DIR!

echo.
echo [3/6] 安装 Python 依赖...
echo.
cd /d "%PROJECT_DIR%"
if exist requirements.txt (
    !PYTHON_CMD! -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] Python 依赖安装失败
        pause
        exit /b 1
    )
)
echo     Python 依赖安装完成

echo.
echo [4/6] 安装 Node.js 根依赖...
echo.
if exist package.json (
    !NPM_CMD! install
    if errorlevel 1 (
        echo [错误] Node.js 根依赖安装失败
        pause
        exit /b 1
    )
)
echo     Node.js 根依赖安装完成

echo.
echo [5/6] 安装 OpenClaw 依赖...
echo.
if exist "openclaw\package.json" (
    cd openclaw
    !NPM_CMD! install
    if errorlevel 1 (
        echo [错误] OpenClaw 依赖安装失败
        pause
        exit /b 1
    )
    cd /d "%PROJECT_DIR%"
)
echo     OpenClaw 依赖安装完成

echo.
echo [6/6] 安装桌面 UI 依赖...
echo.
if exist "desktop\package.json" (
    cd desktop
    !NPM_CMD! install
    if errorlevel 1 (
        echo [错误] 桌面 UI 依赖安装失败
        pause
        exit /b 1
    )
    cd /d "%PROJECT_DIR!"
)
echo     桌面 UI 依赖安装完成

echo.
echo ==========================================
echo   安装完成！
echo ============================================
echo.
echo   下一步：
echo   1. 配置 API Key:
echo      node core\index.js config --set-api-key YOUR_KEY
echo.
echo   2. 运行诊断:
echo      node core\index.js doctor
echo.
echo   3. 启动 ClawMind:
echo      node core\index.js start
echo.
echo   数据目录: !CLAWMIND_DIR!
echo.
pause
```

### 5.2 scripts/post-install.js（npm postinstall）

```javascript
/**
 * npm postinstall 脚本
 * 
 * 在 npm install 后自动执行
 * 用于初始化配置、下载浏览器驱动等
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');

function log(msg) {
  console.log(`[postinstall] ${msg}`);
}

function logError(msg) {
  console.error(`[postinstall] ERROR: ${msg}`);
}

async function main() {
  log('ClawMind post-install 开始...');
  
  try {
    // 1. 确保数据目录存在
    const dataDir = path.join(os.homedir(), 'ClawMind');
    const dirs = [
      dataDir,
      path.join(dataDir, 'logs'),
      path.join(dataDir, 'memory'),
      path.join(dataDir, 'runtime'),
      path.join(dataDir, 'logs', 'hermes'),
      path.join(dataDir, 'logs', 'openclaw')
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`创建目录: ${dir}`);
      }
    }
    
    // 2. 生成默认配置
    const configPath = path.join(dataDir, 'config.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        version: '5.0.0',
        websocketPort: 8765,
        dataDir: dataDir,
        provider: 'openai',
        model: 'gpt-4',
        apiEndpoint: 'https://api.openai.com/v1',
        authHeaderName: 'Authorization',
        authHeaderValuePrefix: 'Bearer ',
        apiKey: '',
        language: 'zh',
        execution: {
          mode: 'serial',
          maxSteps: 8,
          timeout: 60
        },
        security: {
          allowedPaths: [os.homedir()],
          deniedPaths: ['C:/Windows', '/usr/bin'],
          allowedCommands: ['python', 'node', 'git', 'npm']
        },
        notifications: {
          enabled: true,
          sound: true
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      log(`生成默认配置: ${configPath}`);
    }
    
    // 3. 检查 OpenClaw 依赖
    const openclawDir = path.join(PROJECT_ROOT, 'openclaw');
    const openclawNodeModules = path.join(openclawDir, 'node_modules');
    
    if (fs.existsSync(path.join(openclawDir, 'package.json')) && !fs.existsSync(openclawNodeModules)) {
      log('安装 OpenClaw 依赖...');
      execSync('npm install', { cwd: openclawDir, stdio: 'inherit' });
    }
    
    // 4. 初始化 Git hooks（可选）
    const hooksDir = path.join(PROJECT_ROOT, '.git', 'hooks');
    if (fs.existsSync(path.join(PROJECT_ROOT, '.git')) && !fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
    
    log('ClawMind post-install 完成！');
    log('');
    log('下一步：');
    log('  1. 配置 API Key: node core/index.js config --set-api-key YOUR_KEY');
    log('  2. 运行诊断: node core/index.js doctor');
    log('  3. 启动: node core/index.js start');
    
  } catch (err) {
    logError(err.message);
    process.exit(1);
  }
}

main();
```

---

## 七、配置管理

### 7.1 配置数据结构

```typescript
// types/config.ts

interface ClawMindConfig {
  // 版本
  version: string;
  
  // WebSocket 配置
  websocketPort: number;
  
  // 数据目录
  dataDir: string;
  
  // 模型配置
  model: {
    provider: 'openai' | 'anthropic' | 'custom';
    model: string;
    apiEndpoint: string;
    apiKey: string;
    authHeaderName: string;
    authHeaderValuePrefix: string;
  };
  
  // 执行配置
  execution: {
    mode: 'serial' | 'batch';
    maxSteps: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // 安全配置
  security: {
    allowedPaths: string[];
    deniedPaths: string[];
    allowedCommands: string[];
    requireConfirmation: string[];
    trustMode: {
      enabled: boolean;
      timeout: number; // 毫秒
    };
  };
  
  // 通知配置
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    channels: string[];
  };
  
  // 语言
  language: 'zh' | 'en';
  
  // 信任模式
  trustMode: {
    enabled: boolean;
    expiresAt: string | null;
  };
}
```

### 7.2 配置验证（config/schema.json）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "websocketPort", "model"],
  "properties": {
    "version": {
      "type": "string",
      "const": "5.0.0"
    },
    "websocketPort": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535,
      "default": 8765
    },
    "dataDir": {
      "type": "string"
    },
    "model": {
      "type": "object",
      "required": ["provider", "model", "apiEndpoint", "apiKey"],
      "properties": {
        "provider": {
          "type": "string",
          "enum": ["openai", "anthropic", "custom"]
        },
        "model": {
          "type": "string"
        },
        "apiEndpoint": {
          "type": "string",
          "format": "uri"
        },
        "apiKey": {
          "type": "string",
          "minLength": 10
        },
        "authHeaderName": {
          "type": "string",
          "default": "Authorization"
        },
        "authHeaderValuePrefix": {
          "type": "string",
          "default": "Bearer "
        }
      }
    },
    "execution": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["serial", "batch"],
          "default": "serial"
        },
        "maxSteps": {
          "type": "integer",
          "minimum": 1,
          "maximum": 20,
          "default": 8
        },
        "timeout": {
          "type": "integer",
          "minimum": 10,
          "maximum": 600,
          "default": 60
        },
        "retryAttempts": {
          "type": "integer",
          "minimum": 0,
          "maximum": 5,
          "default": 3
        }
      }
    },
    "security": {
      "type": "object",
      "properties": {
        "allowedPaths": {
          "type": "array",
          "items": { "type": "string" }
        },
        "deniedPaths": {
          "type": "array",
          "items": { "type": "string" }
        },
        "allowedCommands": {
          "type": "array",
          "items": { "type": "string" }
        },
        "requireConfirmation": {
          "type": "array",
          "items": { "type": "string" }
        },
        "trustMode": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "timeout": { "type": "integer" }
          }
        }
      }
    },
    "language": {
      "type": "string",
      "enum": ["zh", "en"],
      "default": "zh"
    }
  }
}
```

---

## 八、测试方案

### 8.1 测试结构

```
tests/
├── unit/
│   ├── core/
│   │   ├── config-manager.test.js
│   │   ├── launcher.test.js
│   │   └── doctor.test.js
│   ├── hermes/
│   │   ├── planner.test.js
│   │   └── executor.test.js
│   └── openclaw/
│       ├── client.test.js
│       └── tools.test.js
├── integration/
│   ├── websocket.test.js
│   ├── task-run.test.js
│   └── full-pipeline.test.js
├── fixtures/
│   ├── config.json
│   ├── test-task.txt
│   └── test-plan.json
└── helpers/
    ├── mock-hermes.js
    ├── mock-openclaw.js
    └── test-utils.js
```

### 8.2 集成测试示例

```javascript
// tests/integration/task-run.test.js

const WebSocket = require('ws');

describe('Task Run Integration', () => {
  let hermesWs;
  let openclawWs;
  
  beforeAll(async () => {
    // 启动服务
    await startClawMind();
    
    // 等待服务就绪
    await waitForServices(8765, 30000);
  });
  
  afterAll(async () => {
    await stopClawMind();
  });
  
  test('完整任务执行流程', async () => {
    // 1. 连接到 Hermes
    hermesWs = new WebSocket('ws://localhost:8765');
    
    await new Promise((resolve, reject) => {
      hermesWs.on('open', resolve);
      hermesWs.on('error', reject);
    });
    
    // 2. 发送任务
    const taskId = 'test_task_1';
    hermesWs.send(JSON.stringify({
      type: 'task.run',
      id: taskId,
      input: '在桌面创建一个测试文件 test.txt，内容为 Hello ClawMind'
    }));
    
    // 3. 等待结果
    const result = await new Promise((resolve) => {
      hermesWs.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'task.result' && msg.id === taskId) {
          resolve(msg);
        }
      });
    });
    
    // 4. 验证结果
    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan.steps.length).toBeGreaterThan(0);
    
    // 5. 验证文件确实被创建
    const fs = require('fs');
    const testFile = path.join(os.homedir(), 'Desktop', 'test.txt');
    expect(fs.existsSync(testFile)).toBe(true);
    
    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toBe('Hello ClawMind');
    
    // 清理
    fs.unlinkSync(testFile);
    
    hermesWs.close();
  });
});
```

---

## 九、开发规范

### 8.1 Git 工作流

```
main (生产)
  └── develop (开发)
        ├── feature/xxx
        ├── fix/xxx
        └── refactor/xxx
```

### 8.2 代码风格

**JavaScript**: 使用 ESLint + Prettier
**Python**: 使用 Black + isort + flake8

### 8.3 提交规范

```
<type>(<scope>): <subject>

Types:
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建/工具
```

### 8.4 版本发布

```
1. 更新 CHANGELOG.md
2. 更新版本号 (package.json, requirements.txt)
3. 打 tag
4. GitHub Release
```

---

## 十、部署方案

### 9.1 Windows 部署

```batch
# 打包步骤
1. npm run build --prefix desktop
2. 复制所有文件到发布目录
3. 生成 .exe 安装包 (使用 electron-builder 或 tauri bundler)
```

### 9.2 服务器部署（Docker）

```dockerfile
# Dockerfile
FROM python:3.11-slim

# 安装 Node.js
RUN apt-get update && apt-get install -y nodejs npm

# 设置工作目录
WORKDIR /app

# 复制文件
COPY . .

# 安装依赖
RUN pip install -r requirements.txt
RUN npm install

# 构建桌面 UI
RUN cd desktop && npm install && npm run build

# 暴露端口
EXPOSE 8765

# 启动命令
CMD ["python", "hermes/agent.py"]
```

---

## 十一、排障指南

### 10.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Hermes 启动失败 | Python 版本过低 | 升级到 Python 3.10+ |
| OpenClaw 连接失败 | 端口被占用 | 检查 8765 端口，或修改配置 |
| pip 安装失败 | 网络问题 | 使用国内镜像 |
| npm 安装失败 | Node 版本过低 | 升级到 Node 18+ |
| API 调用失败 | API Key 错误 | 检查 config.json |

### 10.2 日志位置

```
~/ClawMind/
├── logs/
│   ├── hermes/
│   │   ├── stdout.log
│   │   └── stderr.log
│   └── openclaw/
│       ├── stdout.log
│       └── stderr.log
└── runtime/
    ├── hermes.pid
    └── openclaw.pid
```

---

## 十二、里程碑计划

### Phase 1: 框架集成（1-2 周）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 调研 Hermes Agent 官方 API | 3天 | - |
| 调研 OpenClaw 官方 API | 3天 | - |
| 设计扩展层架构 | 2天 | 调研完成 |
| 实现 Hermes 扩展层 | 3天 | 架构设计 |
| 实现 OpenClaw 扩展层 | 3天 | 架构设计 |
| 集成测试 | 3天 | 扩展层完成 |

### Phase 2: 核心功能（2-3 周）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 配置管理完善 | 2天 | - |
| doctor 诊断完善 | 2天 | - |
| 进程管理完善 | 2天 | - |
| WebSocket 通信调优 | 3天 | - |
| 记忆系统同步 | 3天 | - |
| 技能系统对接 | 3天 | - |

### Phase 3: UI 与体验（2 周）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| Vue3 UI 完善 | 5天 | - |
| Tauri 打包 | 3天 | UI完成 |
| 安装脚本优化 | 2天 | - |

### Phase 4: 测试与文档（1 周）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 单元测试 | 3天 | - |
| 集成测试 | 2天 | - |
| 文档完善 | 2天 | - |

---

## 十三、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Hermes Agent 框架 API 变更 | 高 | 隔离封装，发现不兼容及时升级 |
| OpenClaw 框架不稳定 | 中 | 保留自研实现作为备选 |
| pip/npm 依赖冲突 | 中 | 使用虚拟环境 + lock 文件 |
| 跨平台兼容问题 | 中 | 主要测试 Windows，Linux 次之 |
| LLM API 限制 | 高 | 实现请求队列和降级策略 |

---

**文档版本**: v1.0
**最后更新**: 2026-04-24
**维护人**: ClawMind Team
