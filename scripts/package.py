# ClawMind 打包脚本
# 用于将 Python 和 Node.js 运行时打包成独立可执行文件

import os
import sys
import shutil
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DIST_DIR = PROJECT_ROOT / "dist"
HERMES_DIST = PROJECT_ROOT / "hermes-dist"
OPENCLAW_DIST = PROJECT_ROOT / "openclaw-dist"
DESKTOP_BINARIES = PROJECT_ROOT / "desktop" / "src-tauri" / "binaries"

def clean_dist():
    """清理旧的打包文件"""
    print("🧹 Cleaning old distributions...")
    for dir in [DIST_DIR, HERMES_DIST, OPENCLAW_DIST, DESKTOP_BINARIES]:
        if dir.exists():
            shutil.rmtree(dir)
        dir.mkdir(parents=True, exist_ok=True)

def package_hermes():
    """使用 PyInstaller 打包 Hermes"""
    print("\n📦 Packaging Hermes (Python)...")

    hermes_dir = PROJECT_ROOT / "hermes"
    spec_content = f"""
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['{hermes_dir / "server.py"}'],
    pathex=['{hermes_dir}'],
    binaries=[],
    datas=[
        ('{hermes_dir / "planner.py"}', 'hermes'),
        ('{hermes_dir / "executor.py"}', 'hermes'),
    ],
    hiddenimports=['websockets', 'asyncio'],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='hermes',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
"""

    spec_file = DIST_DIR / "hermes.spec"
    spec_file.write_text(spec_content)

    # Run PyInstaller
    subprocess.run([
        sys.executable, "-m", "PyInstaller",
        str(spec_file),
        "--distpath", str(HERMES_DIST),
        "--workpath", str(DIST_DIR / "build"),
        "--clean"
    ], check=True)

    # Copy to desktop binaries
    hermes_exe = HERMES_DIST / ("hermes.exe" if sys.platform == "win32" else "hermes")
    if hermes_exe.exists():
        shutil.copy(hermes_exe, DESKTOP_BINARIES / hermes_exe.name)
        print(f"✅ Hermes packaged: {hermes_exe}")
    else:
        print("❌ Hermes packaging failed")
        sys.exit(1)

def package_openclaw():
    """使用 pkg 打包 OpenClaw"""
    print("\n📦 Packaging OpenClaw (Node.js)...")

    openclaw_dir = PROJECT_ROOT / "openclaw"

    # Create package.json for pkg if not exists
    pkg_config = {
        "name": "openclaw-bundled",
        "version": "1.0.0",
        "bin": "client.js",
        "pkg": {
            "assets": [
                "modules/**/*"
            ],
            "targets": [
                "node18-win-x64" if sys.platform == "win32" else "node18-linux-x64"
            ],
            "outputPath": str(OPENCLAW_DIST)
        }
    }

    # Install pkg if not installed
    subprocess.run(["npm", "install", "-g", "pkg"], check=True)

    # Run pkg
    target = "node18-win-x64" if sys.platform == "win32" else "node18-linux-x64"
    subprocess.run([
        "pkg",
        str(openclaw_dir / "client.js"),
        "--target", target,
        "--output", str(OPENCLAW_DIST / ("openclaw.exe" if sys.platform == "win32" else "openclaw"))
    ], check=True)

    # Copy to desktop binaries
    openclaw_exe = OPENCLAW_DIST / ("openclaw.exe" if sys.platform == "win32" else "openclaw")
    if openclaw_exe.exists():
        shutil.copy(openclaw_exe, DESKTOP_BINARIES / openclaw_exe.name)
        print(f"✅ OpenClaw packaged: {openclaw_exe}")
    else:
        print("❌ OpenClaw packaging failed")
        sys.exit(1)

def build_tauri():
    """构建 Tauri 桌面应用"""
    print("\n🏗️  Building Tauri desktop app...")

    desktop_dir = PROJECT_ROOT / "desktop"

    # Install dependencies
    subprocess.run(["npm", "install"], cwd=desktop_dir, check=True)

    # Build Tauri
    subprocess.run(["npm", "run", "tauri", "build"], cwd=desktop_dir, check=True)

    print("✅ Tauri build completed")

def main():
    print("=" * 60)
    print("ClawMind Packaging Script")
    print("=" * 60)

    # Check dependencies
    try:
        import PyInstaller
    except ImportError:
        print("❌ PyInstaller not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    # Run packaging steps
    clean_dist()
    package_hermes()
    package_openclaw()
    build_tauri()

    print("\n" + "=" * 60)
    print("✅ Packaging completed successfully!")
    print("=" * 60)
    print(f"\nOutput:")
    print(f"  - Hermes binary: {DESKTOP_BINARIES / 'hermes.exe'}")
    print(f"  - OpenClaw binary: {DESKTOP_BINARIES / 'openclaw.exe'}")
    print(f"  - Tauri installer: {desktop_dir / 'src-tauri' / 'target' / 'release' / 'bundle'}")

if __name__ == "__main__":
    main()
