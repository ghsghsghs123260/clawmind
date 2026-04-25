# ClawMind 打包说明

## 概述

本文档说明如何将 ClawMind 打包成一键开箱即用的桌面应用。

## 打包架构

```
ClawMind.exe (单文件安装包)
├── Tauri 桌面应用
│   ├── Vue3 前端界面
│   └── Rust 后端
│       ├── 自动启动服务
│       └── 进程管理
├── 内嵌 Python 运行时 (PyInstaller)
│   └── hermes.exe (独立可执行)
└── 内嵌 Node.js 运行时 (pkg)
    └── openclaw.exe (独立可执行)
```

## 打包步骤

### 1. 准备环境

**Windows:**
```bash
# 安装 Python 3.8+
# 安装 Node.js 18+
# 安装 Rust
winget install Rustlang.Rustup

# 验证安装
python --version
node --version
cargo --version
```

**Linux/macOS:**
```bash
# 安装依赖
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. 安装依赖

```bash
# Python 依赖
pip install -r requirements.txt
pip install pyinstaller

# Node.js 依赖
npm install
cd desktop && npm install && cd ..

# 全局安装 pkg
npm install -g pkg
```

### 3. 运行打包脚本

**Windows:**
```bash
scripts\build-windows.bat
```

**Linux/macOS:**
```bash
chmod +x scripts/build-linux.sh
./scripts/build-linux.sh
```

**或使用 Python 脚本:**
```bash
python scripts/package.py
```

### 4. 输出文件

打包完成后，输出文件位于：

```
desktop/src-tauri/target/release/bundle/
├── msi/                    # Windows 安装包
│   └── ClawMind_5.0.0_x64.msi
├── nsis/                   # Windows 便携版
│   └── ClawMind_5.0.0_x64-setup.exe
└── deb/                    # Linux 安装包
    └── clawmind_5.0.0_amd64.deb
```

## 打包流程详解

### Step 1: 打包 Hermes (Python)

使用 PyInstaller 将 Python 代码和运行时打包成单个可执行文件：

```bash
pyinstaller hermes/server.py \
  --onefile \
  --name hermes \
  --add-data "hermes/planner.py:hermes" \
  --add-data "hermes/executor.py:hermes" \
  --hidden-import websockets \
  --hidden-import asyncio \
  --noconsole
```

输出: `hermes-dist/hermes.exe` (约 15-20 MB)

### Step 2: 打包 OpenClaw (Node.js)

使用 pkg 将 Node.js 代码和运行时打包成单个可执行文件：

```bash
pkg openclaw/client.js \
  --target node18-win-x64 \
  --output openclaw-dist/openclaw.exe \
  --assets "openclaw/modules/**/*"
```

输出: `openclaw-dist/openclaw.exe` (约 40-50 MB)

### Step 3: 复制到 Tauri 资源目录

```bash
mkdir -p desktop/src-tauri/binaries
cp hermes-dist/hermes.exe desktop/src-tauri/binaries/
cp openclaw-dist/openclaw.exe desktop/src-tauri/binaries/
```

### Step 4: 构建 Tauri 应用

```bash
cd desktop
npm run tauri build
```

Tauri 会：
1. 编译 Rust 后端
2. 打包 Vue3 前端
3. 将 binaries/ 中的可执行文件嵌入
4. 生成安装包

## 用户使用流程

### Windows 用户

1. 下载 `ClawMind_5.0.0_x64-setup.exe`
2. 双击运行安装程序
3. 安装完成后，桌面出现 ClawMind 图标
4. 双击图标启动应用
5. 首次启动自动弹出配置向导
6. 输入 API Key 和模型
7. 开始使用

### 后台服务自动管理

应用启动时，Tauri 后端会自动：
1. 启动 `hermes.exe` (WebSocket 服务器)
2. 启动 `openclaw.exe` (执行引擎)
3. 监控进程状态
4. 应用关闭时自动停止服务

用户无需手动操作任何命令行。

## 配置文件位置

打包后的应用会将配置文件存储在：

**Windows:**
```
C:\Users\<用户名>\AppData\Roaming\ClawMind\
├── config.json
├── logs/
└── memory/
```

**Linux:**
```
~/.config/ClawMind/
```

**macOS:**
```
~/Library/Application Support/ClawMind/
```

## 文件大小估算

| 组件 | 大小 |
|------|------|
| hermes.exe | 15-20 MB |
| openclaw.exe | 40-50 MB |
| Tauri 应用 | 10-15 MB |
| Vue3 前端 | 2-3 MB |
| **总计** | **70-90 MB** |

## 优化建议

### 减小体积

1. **UPX 压缩**
```bash
upx --best hermes.exe
upx --best openclaw.exe
```
可减小 30-40% 体积

2. **移除调试符号**
```bash
strip hermes.exe
strip openclaw.exe
```

3. **Tauri 优化**
在 `tauri.conf.json` 中启用：
```json
{
  "bundle": {
    "resources": {
      "compress": true
    }
  }
}
```

### 加快启动速度

1. 使用延迟加载
2. 预编译 Python 字节码
3. 启用 Tauri 的 `lazy-loading`

## 故障排查

### PyInstaller 打包失败

```bash
# 清理缓存
pyinstaller --clean hermes.spec

# 查看详细日志
pyinstaller --log-level DEBUG hermes.spec
```

### pkg 打包失败

```bash
# 更新 pkg
npm install -g pkg@latest

# 使用 --debug 查看详情
pkg --debug openclaw/client.js
```

### Tauri 构建失败

```bash
# 清理构建缓存
cd desktop/src-tauri
cargo clean

# 重新构建
npm run tauri build
```

## 持续集成 (CI/CD)

可以使用 GitHub Actions 自动打包：

```yaml
name: Build Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - uses: actions/setup-node@v3
      - uses: dtolnay/rust-toolchain@stable
      
      - name: Build
        run: scripts\build-windows.bat
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ClawMind-Windows
          path: desktop/src-tauri/target/release/bundle/
```

## 下一步

- [ ] 添加代码签名 (Windows Authenticode)
- [ ] 添加自动更新功能 (Tauri Updater)
- [ ] 创建 macOS .dmg 安装包
- [ ] 创建 Linux AppImage
- [ ] 添加崩溃报告系统
