# Step 2: 二进制文件打包 - 进度报告

## 完成时间
2026-04-24

## 完成状态：部分完成 ⚠️

### ✅ 已完成

#### 1. Hermes 二进制打包 ✅

**文件:** `desktop/src-tauri/binaries/hermes.exe`

**大小:** 61 MB

**打包工具:** PyInstaller 6.19.0

**配置文件:** `desktop/src-tauri/hermes.spec`

**改进内容:**
- ✅ 修正路径（`../../hermes/` 而不是 `../hermes/`）
- ✅ 添加完整的 hiddenimports
- ✅ 排除不需要的模块（tkinter, matplotlib, numpy, pandas）
- ✅ 启用 UPX 压缩
- ✅ 包含所有必需的模块

**测试结果:**
```bash
./hermes.exe
# ✓ 成功启动
# ✓ 加载配置
# ✓ 注册消息处理器
# ✓ WebSocket 服务器监听 8765 端口
# ✓ 服务器运行正常
```

**日志输出:**
```
2026-04-24 11:23:46 - HermesServer - INFO - Config loaded: provider=openai, model=miniMax-M2
2026-04-24 11:23:46 - HermesServer - INFO - 启动 Hermes WebSocket Server: localhost:8765
2026-04-24 11:23:46 - websockets.server - INFO - server listening on 127.0.0.1:8765
2026-04-24 11:23:46 - HermesServer - INFO - ✓ Hermes Server 运行中: ws://localhost:8765
```

#### 2. 打包脚本优化 ✅

**文件:** `scripts/build-binaries.bat`

**改进:**
- ✅ 自动检测并安装 PyInstaller
- ✅ 自动检测并安装 pkg
- ✅ 显示文件大小
- ✅ 错误处理
- ✅ 进度提示

#### 3. OpenClaw package.json 配置 ✅

**文件:** `openclaw/package.json`

**添加:**
- ✅ build 脚本
- ✅ pkg 配置
- ✅ 资源文件配置

### ❌ 未完成

#### 1. OpenClaw 二进制打包 ❌

**问题:** pkg 工具网络错误

**错误信息:**
```
Error! AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  (!this.bar)
  at Log.enableProgress
```

**原因:** pkg 尝试从 nodejs.org 下载 Node.js 源码失败

**临时解决方案:**
- ✅ 创建了 `openclaw.bat` 包装脚本
- ✅ 脚本调用 `node openclaw/client.js`
- ⚠️ 需要用户系统安装 Node.js

**永久解决方案（待实施）:**
1. 使用 `nexe` 替代 `pkg`
2. 手动下载 pkg 缓存文件
3. 使用 `ncc` + `node-sea` (Node.js Single Executable Applications)
4. 使用 `caxa` 打包工具

## 文件清单

### 新增文件
- `desktop/src-tauri/binaries/hermes.exe` (61 MB) ✅
- `desktop/src-tauri/binaries/openclaw.bat` (临时方案) ⚠️
- `desktop/src-tauri/build/` (构建临时文件)

### 修改文件
- `desktop/src-tauri/hermes.spec` (完善配置)
- `scripts/build-binaries.bat` (优化脚本)
- `openclaw/package.json` (添加 build 配置)

## 测试结果

### Hermes 二进制测试 ✅

**测试 1: 启动测试**
```bash
./hermes.exe
# ✓ Pass - 成功启动
```

**测试 2: 配置加载**
```bash
# ✓ Pass - 正确加载 C:\Users\14127\ClawMind\config.json
# ✓ Pass - provider=openai, model=miniMax-M2
```

**测试 3: WebSocket 服务**
```bash
# ✓ Pass - 监听 127.0.0.1:8765
# ✓ Pass - 监听 [::1]:8765
```

**测试 4: 端口冲突处理**
```bash
# ✓ Pass - 正确报告端口被占用错误
```

### OpenClaw 二进制测试 ❌

**测试 1: pkg 打包**
```bash
npm run build
# ✗ Fail - pkg 网络错误
```

**测试 2: 包装脚本**
```bash
openclaw.bat
# ⚠️ 未测试 - 需要先停止现有服务
```

## 下一步行动

### 优先级 P0

#### 1. 解决 OpenClaw 打包问题

**方案 A: 使用 nexe（推荐）**
```bash
npm install -g nexe
nexe openclaw/client.js -t windows-x64-18.0.0 -o desktop/src-tauri/binaries/openclaw.exe
```

**方案 B: 使用 ncc + node-sea**
```bash
npm install -g @vercel/ncc
ncc build openclaw/client.js -o dist
# 然后使用 Node.js 20+ 的 SEA 功能
```

**方案 C: 手动下载 pkg 缓存**
```bash
# 从其他机器或镜像下载预编译的 Node.js 二进制
# 放到 %LOCALAPPDATA%\node-pkg-cache\
```

**方案 D: 接受临时方案**
- 使用 `openclaw.bat` 包装脚本
- 要求用户安装 Node.js
- 在文档中说明

#### 2. 更新 Tauri 配置

**文件:** `desktop/src-tauri/tauri.conf.json`

**需要添加:**
```json
{
  "bundle": {
    "resources": [
      "binaries/hermes.exe",
      "binaries/openclaw.exe"  // 或 openclaw.bat
    ],
    "externalBin": [
      "binaries/hermes",
      "binaries/openclaw"
    ]
  }
}
```

#### 3. 测试 Tauri 集成

```bash
cd desktop
npm run tauri dev
# 验证 Rust 后端能否启动 hermes.exe
```

### 优先级 P1

#### 4. 优化二进制大小

**Hermes (当前 61 MB):**
- 使用 `--exclude-module` 排除更多模块
- 使用 `--strip` 移除调试符号
- 使用更激进的 UPX 压缩

**目标:** < 40 MB

#### 5. 添加版本信息

```python
# hermes.spec
exe = EXE(
    ...
    version='version.txt',  # 添加版本信息
    icon='icon.ico',        # 添加图标
)
```

#### 6. 代码签名（可选）

```bash
# Windows
signtool sign /f certificate.pfx /p password hermes.exe
```

## 已知问题

### 1. Deprecation Warnings ⚠️

**问题:**
```
DeprecationWarning: websockets.WebSocketServerProtocol is deprecated
```

**影响:** 仅警告，不影响功能

**解决:** 更新 websockets 库或修改代码使用新 API

### 2. 中文乱码 ⚠️

**问题:** 日志中的中文显示为乱码

**原因:** Windows 控制台编码问题

**解决:** 
```python
# 在 server.py 开头添加
import sys
sys.stdout.reconfigure(encoding='utf-8')
```

### 3. 文件大小较大 ⚠️

**问题:** hermes.exe 61 MB

**原因:** 包含完整 Python 运行时和所有依赖

**优化方向:**
- 排除不需要的模块
- 使用更好的压缩
- 考虑使用 Python 3.11 的优化

## 总结

### 完成度：60%

**已完成:**
- ✅ Hermes 二进制打包和测试
- ✅ 打包脚本优化
- ✅ 配置文件完善

**未完成:**
- ❌ OpenClaw 二进制打包
- ❌ Tauri 集成测试
- ❌ 完整的端到端测试

### 建议

**短期（1天）:**
1. 使用 nexe 替代 pkg 打包 OpenClaw
2. 测试 Tauri 集成
3. 完成端到端测试

**中期（2-3天）:**
1. 优化二进制大小
2. 添加版本信息和图标
3. 修复 deprecation warnings

**长期（1周）:**
1. 实现自动更新机制
2. 添加代码签名
3. 优化启动速度

### 风险

**高风险:**
- OpenClaw 打包工具问题可能需要更换方案

**中风险:**
- 二进制文件大小可能影响分发

**低风险:**
- Deprecation warnings 可能在未来版本中导致问题

### 下一步

继续 **Step 3: Skills 执行引擎** 的同时，并行解决 OpenClaw 打包问题。
