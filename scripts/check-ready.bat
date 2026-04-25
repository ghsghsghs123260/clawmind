@echo off
setlocal enabledelayedexpansion
REM ClawMind 开箱即用检查脚本 (Windows)

echo 🔍 ClawMind 开箱即用检查
echo ================================
echo.

REM 检查项目结构
echo 📁 检查项目结构...

set MISSING_DIRS=0
set MISSING_FILES=0

if not exist "hermes" (
    echo   ❌ 缺少目录: hermes
    set /a MISSING_DIRS+=1
)
if not exist "openclaw" (
    echo   ❌ 缺少目录: openclaw
    set /a MISSING_DIRS+=1
)
if not exist "skills" (
    echo   ❌ 缺少目录: skills
    set /a MISSING_DIRS+=1
)
if not exist "src" (
    echo   ❌ 缺少目录: src
    set /a MISSING_DIRS+=1
)

if not exist "cli.js" (
    echo   ❌ 缺少文件: cli.js
    set /a MISSING_FILES+=1
)
if not exist "package.json" (
    echo   ❌ 缺少文件: package.json
    set /a MISSING_FILES+=1
)
if not exist "hermes\server.py" (
    echo   ❌ 缺少文件: hermes\server.py
    set /a MISSING_FILES+=1
)
if not exist "skills\cli.js" (
    echo   ❌ 缺少文件: skills\cli.js
    set /a MISSING_FILES+=1
)

if %MISSING_DIRS%==0 if %MISSING_FILES%==0 (
    echo   ✅ 项目结构完整
) else (
    echo   ⚠️  缺少 %MISSING_DIRS% 个目录, %MISSING_FILES% 个文件
)

echo.

REM 检查依赖
echo 📦 检查依赖...

REM Node.js
where node >nul 2>&1
if %ERRORLEVEL%==0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   ✅ Node.js: !NODE_VERSION!
) else (
    echo   ❌ Node.js 未安装
)

REM Python
where python >nul 2>&1
if %ERRORLEVEL%==0 (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo   ✅ Python: !PYTHON_VERSION!
) else (
    echo   ❌ Python 未安装
)

echo.
echo   检查 Node.js 包...

npm list ws >nul 2>&1
if %ERRORLEVEL%==0 (
    echo     ✅ ws
) else (
    echo     ❌ 缺少: ws
)

npm list chalk >nul 2>&1
if %ERRORLEVEL%==0 (
    echo     ✅ chalk
) else (
    echo     ❌ 缺少: chalk
)

npm list commander >nul 2>&1
if %ERRORLEVEL%==0 (
    echo     ✅ commander
) else (
    echo     ❌ 缺少: commander
)

echo.
echo   检查 Python 包...

python -c "import websockets" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo     ✅ websockets
) else (
    echo     ❌ 缺少: websockets
)

python -c "import pyautogui" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo     ✅ pyautogui
) else (
    echo     ❌ 缺少: pyautogui
)

echo.

REM 检查配置
echo ⚙️  检查配置...

set CONFIG_FOUND=0

if exist "%USERPROFILE%\ClawMind\config.json" (
    echo   ✅ 找到配置: %USERPROFILE%\ClawMind\config.json
    set CONFIG_FOUND=1
)

if exist "%APPDATA%\ClawMind\config.json" (
    echo   ✅ 找到配置: %APPDATA%\ClawMind\config.json
    set CONFIG_FOUND=1
)

if exist "config.json" (
    echo   ✅ 找到配置: config.json
    set CONFIG_FOUND=1
)

if %CONFIG_FOUND%==0 (
    echo   ⚠️  未找到配置文件
    echo      运行: node cli.js config --wizard
)

echo.

REM 检查端口
echo 🔌 检查端口...

netstat -an | findstr ":8765" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo   ⚠️  端口 8765 已被占用
) else (
    echo   ✅ 端口 8765 可用
)

echo.

REM 检查 Skills
echo 🎯 检查 Skills...

if exist "skills\cli.js" (
    node skills\cli.js list 2>nul | findstr "count" >nul 2>&1
    if %ERRORLEVEL%==0 (
        echo   ✅ Skills 系统正常
    ) else (
        echo   ⚠️  Skills 加载失败
    )
) else (
    echo   ❌ skills\cli.js 不存在
)

echo.

REM 检查二进制文件
echo 📦 检查二进制文件...

if exist "desktop\src-tauri\binaries\hermes.exe" (
    echo   ✅ hermes.exe
) else (
    echo   ⚠️  hermes.exe 不存在
)

if exist "desktop\src-tauri\binaries\openclaw.bat" (
    echo   ✅ openclaw.bat
) else (
    echo   ⚠️  openclaw.bat 不存在
)

echo.

REM 总结
echo ================================
echo 📊 检查总结
echo.

echo   系统状态:
node cli.js status 2>nul

echo.
echo   快速启动:
echo     node cli.js start
echo.
echo   配置向导:
echo     node cli.js config --wizard
echo.
echo   查看帮助:
echo     node cli.js --help
echo.
