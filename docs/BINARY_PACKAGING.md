# ClawMind 二进制打包指南

## 概述

本文档说明如何将 Hermes 和 OpenClaw 打包成独立的可执行文件，并集成到 Tauri 桌面应用中。

## 打包架构

```
ClawMind 桌面应用
├── Tauri 应用 (Rust + Vue3)
│   └── 内嵌二进制文件
│       ├── hermes.exe (Python 打包)
│       └── openclaw.exe (Node.js 打包)
└── 自动启动和管理这些进程
```

## 前置要求

### Windows
- Python 3.8+ (已安装)
- Node.js 18+ (已安装)
- Rust (已安装)
- PyInstaller: `pip install pyinstaller`
- pkg: `npm install -g pkg`

### Linux/macOS
- Python 3.8+
- Node.js 18+
- Rust
- PyInstaller: `pip install pyinstaller`
- pkg: `npm install -g pkg`

## 打包步骤

### 方法 1: 使用自动化脚本（推荐）

**Windows:**
```bash
cd C:\Users\14127\Desktop\clawmind
scripts\build-binaries.bat
```

**Linux/macOS:**
```bash
cd ~/clawmind
chmod +x scripts/build-binaries.sh
./scripts/build-binaries.sh
```

### 方法 2: 手动打包

#### Step 1: 打包 Hermes (Python)

```bash
# 安装依赖
pip install -r hermes/requirements.txt
pip install pyinstaller

# 进入 Tauri 目录
cd desktop/src-tauri

# 使用 spec 文件打包
pyinstaller hermes.spec --clean --distpath binaries --workpath build

# 验证
ls binaries/hermes.exe  # Windows
ls binaries/hermes      # Linux/macOS
```

**hermes.spec 配置说明:**
- `Analysis`: 指定入口文件 `hermes/server.py`
- `datas`: 包含 `planner.py`、`executor.py`、`modules/`
- `hiddenimports`: 显式导入 websockets、pyautogui、PIL
- `console=True`: 保留控制台窗口（便于调试）
- `upx=True`: 启用 UPX 压缩

#### Step 2: 打包 OpenClaw (Node.js)

```bash
# 安装依赖
cd openclaw
npm install

# 安装 pkg
npm install -g pkg

# 打包
pkg client.js \
  --target node18-win-x64 \
  --output ../desktop/src-tauri/binaries/openclaw.exe \
  --compress GZip

# 验证
ls ../desktop/src-tauri/binaries/openclaw.exe
```

**pkg 参数说明:**
- `--target`: 目标平台（node18-win-x64, node18-linux-x64, node18-macos-x64）
- `--output`: 输出文件路径
- `--compress GZip`: 启用 GZip 压缩

#### Step 3: 验证二进制文件

```bash
cd desktop/src-tauri/binaries

# 测试 Hermes
./hermes.exe  # 应该启动 WebSocket 服务器

# 测试 OpenClaw
./openclaw.exe  # 应该尝试连接 Hermes
```

## 文件结构

打包完成后的目录结构：

```
desktop/src-tauri/
├── binaries/
│   ├── hermes.exe      (15-20 MB)
│   └── openclaw.exe    (40-50 MB)
├── hermes.spec
├── build/              (临时构建文件)
└── src/
    └── lib.rs          (调用这些二进制文件)
```

## Tauri 集成

### tauri.conf.json 配置

```json
{
  "bundle": {
    "resources": [
      "../hermes-dist/*",
      "../openclaw-dist/*"
    ],
    "externalBin": [
      "binaries/hermes",
      "binaries/openclaw"
    ]
  }
}
```

### Rust 代码调用

```rust
// lib.rs
let hermes_bin = if cfg!(target_os = "windows") {
    "binaries/hermes.exe"
} else {
    "binaries/hermes"
};

Command::new(hermes_bin).spawn()
```

## 打包后的文件大小

| 组件 | 原始大小 | 打包后大小 | 压缩后大小 |
|------|---------|-----------|-----------|
| Hermes (Python) | ~500 KB | 15-20 MB | 10-15 MB (UPX) |
| OpenClaw (Node.js) | ~50 KB | 40-50 MB | 30-40 MB (GZip) |
| **总计** | ~550 KB | **55-70 MB** | **40-55 MB** |

## 优化建议

### 1. 减小 Hermes 体积

```bash
# 使用 --onefile 模式
pyinstaller hermes.spec --onefile

# 排除不需要的模块
# 在 hermes.spec 中添加:
excludes=['tkinter', 'matplotlib', 'numpy']
```

### 2. 减小 OpenClaw 体积

```bash
# 移除 Puppeteer（如果不需要浏览器自动化）
npm uninstall puppeteer

# 使用 --no-bytecode 减小体积
pkg client.js --no-bytecode
```

### 3. 使用 UPX 压缩

```bash
# 下载 UPX: https://upx.github.io/
upx --best binaries/hermes.exe
upx --best binaries/openclaw.exe

# 可减小 30-40% 体积
```

## 常见问题

### Q1: PyInstaller 打包失败

**错误:** `ModuleNotFoundError: No module named 'websockets'`

**解决:**
```bash
pip install websockets pyautogui pillow
pyinstaller hermes.spec --clean
```

### Q2: pkg 打包失败

**错误:** `Error: Cannot find module 'ws'`

**解决:**
```bash
cd openclaw
npm install
pkg client.js --target node18-win-x64
```

### Q3: 二进制文件无法运行

**错误:** `The application was unable to start correctly (0xc000007b)`

**解决:**
- 安装 Visual C++ Redistributable
- 使用 `--debug` 查看详细错误
- 检查目标平台是否匹配（x64 vs x86）

### Q4: Tauri 找不到二进制文件

**错误:** `Failed to start Hermes: No such file or directory`

**解决:**
```bash
# 确保文件在正确位置
ls desktop/src-tauri/binaries/

# 检查 tauri.conf.json 配置
# 确保 externalBin 路径正确
```

## 测试清单

- [ ] Hermes 二进制文件存在
- [ ] OpenClaw 二进制文件存在
- [ ] Hermes 可以独立运行
- [ ] OpenClaw 可以独立运行
- [ ] Hermes 启动 WebSocket 服务器（端口 8765）
- [ ] OpenClaw 连接到 Hermes
- [ ] Tauri 应用可以启动这两个进程
- [ ] 应用关闭时进程正确停止

## 持续集成

### GitHub Actions 示例

```yaml
name: Build Binaries

on:
  push:
    branches: [main]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build binaries
        run: scripts\build-binaries.bat
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: binaries-windows
          path: desktop/src-tauri/binaries/
```

## 下一步

完成二进制打包后：

1. 运行 `cd desktop && npm run tauri build`
2. 生成最终安装包
3. 测试安装包在干净系统上的运行
4. 发布到 GitHub Releases

## 参考资料

- [PyInstaller 文档](https://pyinstaller.org/)
- [pkg 文档](https://github.com/vercel/pkg)
- [Tauri 打包指南](https://tauri.app/v1/guides/building/)
