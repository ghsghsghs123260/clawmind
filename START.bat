@echo off
REM ClawMind 快速启动脚本

echo ==========================================
echo ClawMind AI Agent System
echo ==========================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    echo Download: https://www.python.org/
    pause
    exit /b 1
)

echo [OK] Node.js and Python found
echo.

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    call npm install
    echo.
)

if not exist "hermes\__pycache__" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
    echo.
)

REM 显示菜单
:menu
echo ==========================================
echo ClawMind 启动菜单
echo ==========================================
echo.
echo 1. 启动 ClawMind (命令行模式)
echo 2. 启动桌面应用 (GUI 模式)
echo 3. 查看状态
echo 4. 停止服务
echo 5. 运行诊断
echo 6. 配置向导
echo 7. 退出
echo.
set /p choice="请选择 (1-7): "

if "%choice%"=="1" goto start_cli
if "%choice%"=="2" goto start_desktop
if "%choice%"=="3" goto status
if "%choice%"=="4" goto stop
if "%choice%"=="5" goto doctor
if "%choice%"=="6" goto config
if "%choice%"=="7" goto end

echo [ERROR] Invalid choice
goto menu

:start_cli
echo.
echo Starting ClawMind CLI...
node cli.js start
goto menu

:start_desktop
echo.
echo Starting ClawMind Desktop App...
cd desktop
if not exist "node_modules" (
    echo Installing desktop dependencies...
    call npm install
)
call npm run tauri dev
cd ..
goto menu

:status
echo.
node cli.js status
echo.
pause
goto menu

:stop
echo.
node cli.js stop
echo.
pause
goto menu

:doctor
echo.
node cli.js doctor
echo.
pause
goto menu

:config
echo.
node cli.js config --wizard
echo.
pause
goto menu

:end
echo.
echo Goodbye!
exit /b 0
