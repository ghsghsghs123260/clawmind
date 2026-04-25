#!/bin/bash
# ClawMind 开箱即用检查脚本

echo "🔍 ClawMind 开箱即用检查"
echo "================================"
echo ""

# 检查项目结构
echo "📁 检查项目结构..."

REQUIRED_DIRS=(
  "hermes"
  "openclaw"
  "skills"
  "src"
  "desktop"
)

REQUIRED_FILES=(
  "cli.js"
  "package.json"
  "requirements.txt"
  "hermes/server.py"
  "hermes/planner.py"
  "hermes/executor.py"
  "hermes/skills_integration.py"
  "openclaw/client.js"
  "skills/parser.js"
  "skills/matcher.js"
  "skills/executor.js"
  "skills/manager.js"
  "skills/adapter.js"
  "skills/cli.js"
  "skills/builtin/file_search.json"
  "skills/builtin/search_web.md"
  "skills/builtin/take_screenshot.json"
)

missing_dirs=0
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "  ❌ 缺少目录: $dir"
    missing_dirs=$((missing_dirs + 1))
  fi
done

missing_files=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "  ❌ 缺少文件: $file"
    missing_files=$((missing_files + 1))
  fi
done

if [ $missing_dirs -eq 0 ] && [ $missing_files -eq 0 ]; then
  echo "  ✅ 项目结构完整"
else
  echo "  ⚠️  缺少 $missing_dirs 个目录, $missing_files 个文件"
fi

echo ""

# 检查依赖
echo "📦 检查依赖..."

# Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo "  ✅ Node.js: $NODE_VERSION"
else
  echo "  ❌ Node.js 未安装"
fi

# Python
if command -v python &> /dev/null; then
  PYTHON_VERSION=$(python --version)
  echo "  ✅ Python: $PYTHON_VERSION"
else
  echo "  ❌ Python 未安装"
fi

# npm 包
echo ""
echo "  检查 Node.js 包..."
REQUIRED_NPM_PACKAGES=(
  "ws"
  "chalk"
  "commander"
)

missing_npm=0
for pkg in "${REQUIRED_NPM_PACKAGES[@]}"; do
  if ! npm list "$pkg" &> /dev/null; then
    echo "    ❌ 缺少: $pkg"
    missing_npm=$((missing_npm + 1))
  fi
done

if [ $missing_npm -eq 0 ]; then
  echo "    ✅ Node.js 包完整"
else
  echo "    ⚠️  缺少 $missing_npm 个包"
fi

# Python 包
echo ""
echo "  检查 Python 包..."
REQUIRED_PY_PACKAGES=(
  "websockets"
  "pyautogui"
)

missing_py=0
for pkg in "${REQUIRED_PY_PACKAGES[@]}"; do
  if ! python -c "import $pkg" &> /dev/null 2>&1; then
    echo "    ❌ 缺少: $pkg"
    missing_py=$((missing_py + 1))
  fi
done

if [ $missing_py -eq 0 ]; then
  echo "    ✅ Python 包完整"
else
  echo "    ⚠️  缺少 $missing_py 个包"
fi

echo ""

# 检查配置
echo "⚙️  检查配置..."

CONFIG_LOCATIONS=(
  "$HOME/.clawmind/config.json"
  "$APPDATA/ClawMind/config.json"
  "./config.json"
)

config_found=0
for loc in "${CONFIG_LOCATIONS[@]}"; do
  if [ -f "$loc" ]; then
    echo "  ✅ 找到配置: $loc"
    config_found=1
    break
  fi
done

if [ $config_found -eq 0 ]; then
  echo "  ⚠️  未找到配置文件"
  echo "     运行: node cli.js config --wizard"
fi

echo ""

# 检查端口
echo "🔌 检查端口..."

if command -v netstat &> /dev/null; then
  if netstat -an | grep -q ":8765"; then
    echo "  ⚠️  端口 8765 已被占用"
  else
    echo "  ✅ 端口 8765 可用"
  fi
else
  echo "  ⚠️  无法检查端口 (netstat 不可用)"
fi

echo ""

# 检查 Skills
echo "🎯 检查 Skills..."

if [ -f "skills/cli.js" ]; then
  SKILLS_OUTPUT=$(node skills/cli.js list 2>&1)
  SKILLS_COUNT=$(echo "$SKILLS_OUTPUT" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')

  if [ -n "$SKILLS_COUNT" ]; then
    echo "  ✅ 加载了 $SKILLS_COUNT 个 Skills"
  else
    echo "  ⚠️  Skills 加载失败"
  fi
else
  echo "  ❌ skills/cli.js 不存在"
fi

echo ""

# 检查二进制文件
echo "📦 检查二进制文件..."

if [ -f "desktop/src-tauri/binaries/hermes.exe" ]; then
  HERMES_SIZE=$(du -h "desktop/src-tauri/binaries/hermes.exe" | cut -f1)
  echo "  ✅ hermes.exe ($HERMES_SIZE)"
else
  echo "  ⚠️  hermes.exe 不存在"
fi

if [ -f "desktop/src-tauri/binaries/openclaw.bat" ]; then
  echo "  ✅ openclaw.bat"
else
  echo "  ⚠️  openclaw.bat 不存在"
fi

echo ""

# 总结
echo "================================"
echo "📊 检查总结"
echo ""

ISSUES=0

if [ $missing_dirs -gt 0 ] || [ $missing_files -gt 0 ]; then
  echo "  ❌ 项目结构不完整"
  ISSUES=$((ISSUES + 1))
fi

if [ $missing_npm -gt 0 ]; then
  echo "  ❌ Node.js 依赖缺失"
  ISSUES=$((ISSUES + 1))
fi

if [ $missing_py -gt 0 ]; then
  echo "  ❌ Python 依赖缺失"
  ISSUES=$((ISSUES + 1))
fi

if [ $config_found -eq 0 ]; then
  echo "  ⚠️  配置文件缺失"
  ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "  ✅ 系统可以开箱即用！"
  echo ""
  echo "  启动命令: node cli.js start"
else
  echo "  ⚠️  发现 $ISSUES 个问题需要修复"
  echo ""
  echo "  修复步骤:"

  if [ $missing_npm -gt 0 ]; then
    echo "    1. npm install"
  fi

  if [ $missing_py -gt 0 ]; then
    echo "    2. pip install -r requirements.txt"
  fi

  if [ $config_found -eq 0 ]; then
    echo "    3. node cli.js config --wizard"
  fi
fi

echo ""
