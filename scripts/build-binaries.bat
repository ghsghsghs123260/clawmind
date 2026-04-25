@echo off
REM Build script for packaging Hermes and OpenClaw into Tauri binaries

setlocal enabledelayedexpansion

set PROJECT_ROOT=%~dp0..
set TAURI_DIR=%PROJECT_ROOT%\desktop\src-tauri
set BINARIES_DIR=%TAURI_DIR%\binaries

echo ==========================================
echo ClawMind Binary Packaging Script
echo ==========================================
echo.
echo Project Root: %PROJECT_ROOT%
echo Binaries Dir: %BINARIES_DIR%
echo.

REM Create binaries directory
if not exist "%BINARIES_DIR%" mkdir "%BINARIES_DIR%"

REM Step 1: Package Hermes (Python)
echo Step 1: Packaging Hermes (Python)...
echo ----------------------------------------

REM Check if PyInstaller is installed
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

REM Install Hermes dependencies
echo Installing Hermes dependencies...
pip install -r "%PROJECT_ROOT%\requirements.txt"

REM Build Hermes executable
echo Building Hermes executable...
cd /d "%TAURI_DIR%"
pyinstaller hermes.spec --clean --distpath "%BINARIES_DIR%" --workpath "%TAURI_DIR%\build"

if exist "%BINARIES_DIR%\hermes.exe" (
    echo [OK] Hermes packaged successfully
    for %%A in ("%BINARIES_DIR%\hermes.exe") do echo     Size: %%~zA bytes
) else (
    echo [ERROR] Hermes packaging failed
    exit /b 1
)

REM Step 2: Package OpenClaw (Node.js)
echo.
echo Step 2: Packaging OpenClaw (Node.js)...
echo ----------------------------------------

REM Check if pkg is installed
where pkg >nul 2>&1
if errorlevel 1 (
    echo Installing pkg...
    call npm install -g pkg
)

REM Install OpenClaw dependencies
echo Installing OpenClaw dependencies...
cd /d "%PROJECT_ROOT%\openclaw"
call npm install

REM Build OpenClaw executable
echo Building OpenClaw executable...
call npm run build

if exist "%BINARIES_DIR%\openclaw.exe" (
    echo [OK] OpenClaw packaged successfully
    for %%A in ("%BINARIES_DIR%\openclaw.exe") do echo     Size: %%~zA bytes
) else (
    echo [ERROR] OpenClaw packaging failed
    exit /b 1
)

REM Step 3: Verify binaries
echo.
echo Step 3: Verifying binaries...
echo ----------------------------------------

cd /d "%BINARIES_DIR%"
dir /b

echo.
echo ==========================================
echo [OK] Binary packaging completed!
echo ==========================================
echo.
echo Binaries location: %BINARIES_DIR%
echo.
echo Next steps:
echo   1. cd desktop
echo   2. npm run tauri build
echo.

pause

