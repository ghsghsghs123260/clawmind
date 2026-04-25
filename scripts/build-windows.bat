@echo off
REM ClawMind Windows 打包脚本

echo ========================================
echo ClawMind Packaging for Windows
echo ========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    exit /b 1
)

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    exit /b 1
)

REM 检查 Rust
cargo --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust not found. Please install Rust from https://rustup.rs/
    exit /b 1
)

echo [OK] All dependencies found
echo.

REM 安装 Python 依赖
echo Installing Python dependencies...
pip install -r requirements.txt
pip install pyinstaller

REM 安装 Node.js 依赖
echo.
echo Installing Node.js dependencies...
cd desktop
call npm install
cd ..

REM 运行打包脚本
echo.
echo Running packaging script...
python scripts/package.py

if errorlevel 1 (
    echo.
    echo [ERROR] Packaging failed
    exit /b 1
)

echo.
echo ========================================
echo Packaging completed successfully!
echo ========================================
echo.
echo Output location:
echo   desktop\src-tauri\target\release\bundle\
echo.
pause
