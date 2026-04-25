# ClawMind 快速启动指南

## 🚀 三种运行方式

### 方式 1: 一键启动脚本（推荐新手）

**Windows:**
```bash
双击 START.bat
```

**Linux/macOS:**
```bash
chmod +x START.sh
./START.sh
```

启动菜单：
```
1. 启动 ClawMind (命令行模式)
2. 启动桌面应用 (GUI 模式)
3. 查看状态
4. 停止服务
5. 运行诊断
6. 配置向导
7. 退出
```

### 方式 2: 命令行模式（开发者）

```bash
# 安装依赖（首次运行）
npm install
pip install -r requirements.txt

# 启动服务
node cli.js start

# 查看状态
node cli.js status

# 停止服务
node cli.js stop

# 配置向导
node cli.js config --wizard

# 运行诊断
node cli.js doctor
```

### 方式 3: 桌面应用模式（最终用户）

```bash
# 开发模式
cd desktop
npm install
npm run tauri dev

# 生产模式（打包后）
双击 ClawMind.exe
```

## 📋 前置要求

### 开发环境
- Node.js 18+
- Python 3.8+
- Rust (仅桌面应用需要)

### 生产环境（打包后）
- 无需任何依赖
- 双击 .exe 即可运行

## 🔧 首次运行步骤

### 步骤 1: 安装依赖

**Windows:**
```bash
START.bat
# 会自动检测并安装依赖
```

**手动安装:**
```bash
npm install
pip install -r requirements.txt
```

### 步骤 2: 配置 API

```bash
node cli.js config --wizard
```

或者手动编辑 `config/default.json`:
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4",
  "apiEndpoint": "https://api.openai.com/v1"
}
```

### 步骤 3: 启动服务

```bash
node cli.js start
```

或使用启动脚本：
```bash
START.bat  # Windows
./START.sh # Linux/macOS
```

### 步骤 4: 验证运行

```bash
node cli.js status
```

应该看到：
```
✓ Hermes Agent: Running (PID: 1234)
✓ OpenClaw Engine: Running (PID: 5678)
✓ WebSocket: Connected (ws://localhost:8765)
```

## 📁 项目结构

```
clawmind/
├── START.bat              ← Windows 启动脚本
├── START.sh               ← Linux/macOS 启动脚本
├── cli.js                 ← CLI 入口
├── package.json           ← Node.js 配置
├── requirements.txt       ← Python 依赖
│
├── hermes/                ← Hermes Agent (Python)
│   ├── server.py          ← WebSocket 服务器
│   ├── planner.py         ← LLM 规划器
│   └── executor.py        ← 动作执行器
│
├── openclaw/              ← OpenClaw Engine (Node.js)
│   ├── client.js          ← WebSocket 客户端
│   └── modules/           ← 执行模块
│
├── desktop/               ← Tauri 桌面应用
│   ├── src/               ← Vue3 前端
│   └── src-tauri/         ← Rust 后端
│
├── src/                   ← CLI 命令
│   └── commands/          ← start, stop, config, etc.
│
├── config/                ← 配置文件
├── memory/                ← 记忆系统
├── scripts/               ← 打包脚本
└── docs/                  ← 文档
```

## 🎯 常用命令

### CLI 命令

```bash
# 启动服务
node cli.js start

# 停止服务
node cli.js stop

# 重启服务
node cli.js restart

# 查看状态
node cli.js status

# 运行诊断
node cli.js doctor

# 配置向导
node cli.js config --wizard

# 查看日志
node cli.js log

# 查看帮助
node cli.js --help
```

### npm 脚本

```bash
# 启动
npm start

# 停止
npm stop

# 重启
npm restart

# 状态
npm run status

# 诊断
npm run doctor
```

### 桌面应用

```bash
# 开发模式
cd desktop
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 🐛 故障排查

### 问题 1: 端口被占用

**错误:** `Error: listen EADDRINUSE: address already in use :::8765`

**解决:**
```bash
# 停止现有服务
node cli.js stop

# 或手动杀死进程
# Windows
netstat -ano | findstr :8765
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:8765 | xargs kill -9
```

### 问题 2: 依赖未安装

**错误:** `Cannot find module 'xxx'`

**解决:**
```bash
# 重新安装依赖
npm install
pip install -r requirements.txt
```

### 问题 3: Python 找不到

**错误:** `python: command not found`

**解决:**
```bash
# Windows: 使用 py 命令
py -m pip install -r requirements.txt

# Linux/macOS: 使用 python3
python3 -m pip install -r requirements.txt
```

### 问题 4: 配置文件缺失

**错误:** `Configuration file not found`

**解决:**
```bash
# 运行配置向导
node cli.js config --wizard

# 或手动创建
mkdir -p config
echo '{"provider":"openai","apiKey":"sk-...","model":"gpt-4"}' > config/default.json
```

## 📊 运行模式对比

| 特性 | 命令行模式 | 桌面应用（开发） | 桌面应用（打包） |
|------|-----------|----------------|----------------|
| 启动方式 | `node cli.js start` | `npm run tauri dev` | 双击 .exe |
| 依赖要求 | Node.js + Python | Node.js + Python + Rust | 无 |
| 界面 | 终端 | GUI 窗口 | GUI 窗口 |
| 适用场景 | 开发/调试 | 开发/测试 | 最终用户 |
| 文件大小 | ~1 MB | ~100 MB | ~70-90 MB |

## 🎨 桌面应用预览

启动桌面应用后会看到：
- 欢迎页（首次启动）
- API 配置向导
- 服务状态监控
- 对话窗口
- 任务执行面板
- 日志查看器

## 📦 打包成独立应用

### 步骤 1: 打包二进制文件

```bash
scripts\build-binaries.bat  # Windows
./scripts/build-binaries.sh # Linux/macOS
```

### 步骤 2: 构建 Tauri 应用

```bash
cd desktop
npm run tauri build
```

### 步骤 3: 获取安装包

```
desktop/src-tauri/target/release/bundle/
├── msi/ClawMind_5.0.0_x64.msi          (Windows 安装包)
└── nsis/ClawMind_5.0.0_x64-setup.exe   (Windows 便携版)
```

## 🔗 相关文档

- [README.md](../README.md) - 项目概述
- [PACKAGING.md](PACKAGING.md) - 打包指南
- [BINARY_PACKAGING.md](BINARY_PACKAGING.md) - 二进制打包
- [SETUP_WIZARD.md](SETUP_WIZARD.md) - 配置向导

## 💡 快速开始示例

### 示例 1: 第一次运行

```bash
# 1. 双击 START.bat
# 2. 选择 "6. 配置向导"
# 3. 输入 API Key
# 4. 选择 "1. 启动 ClawMind"
# 5. 开始使用
```

### 示例 2: 开发者模式

```bash
# 1. 安装依赖
npm install
pip install -r requirements.txt

# 2. 配置
node cli.js config --wizard

# 3. 启动
node cli.js start

# 4. 测试
node test-task-run.js
```

### 示例 3: 桌面应用

```bash
# 1. 进入桌面目录
cd desktop

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run tauri dev

# 4. 首次配置向导会自动弹出
```

## ⚡ 性能优化

### 减少启动时间
- 使用 `node cli.js start --fast` 跳过检查
- 预编译 Python 字节码
- 使用 SSD 存储

### 减少内存占用
- 关闭不需要的模块
- 调整日志级别
- 限制历史记录数量

## 🔐 安全建议

- 不要将 API Key 提交到 Git
- 使用环境变量存储敏感信息
- 定期更新依赖包
- 启用日志审计

## 📞 获取帮助

- GitHub Issues: [报告问题](https://github.com/your-repo/issues)
- 文档: [docs/](.)
- 示例: [test/](../test/)
