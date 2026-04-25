#!/bin/bash
# Build script for packaging Hermes and OpenClaw into Tauri binaries

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/desktop/src-tauri"
BINARIES_DIR="$TAURI_DIR/binaries"

echo "=========================================="
echo "ClawMind Binary Packaging Script"
echo "=========================================="
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Binaries Dir: $BINARIES_DIR"
echo ""

# Create binaries directory
mkdir -p "$BINARIES_DIR"

# Step 1: Package Hermes (Python)
echo "Step 1: Packaging Hermes (Python)..."
echo "----------------------------------------"

# Check if PyInstaller is installed
if ! python -c "import PyInstaller" 2>/dev/null; then
    echo "Installing PyInstaller..."
    pip install pyinstaller
fi

# Install Hermes dependencies
echo "Installing Hermes dependencies..."
pip install -r "$PROJECT_ROOT/hermes/requirements.txt"

# Build Hermes executable
cd "$TAURI_DIR"
pyinstaller hermes.spec --clean --distpath "$BINARIES_DIR" --workpath "$TAURI_DIR/build"

if [ -f "$BINARIES_DIR/hermes.exe" ] || [ -f "$BINARIES_DIR/hermes" ]; then
    echo "✓ Hermes packaged successfully"
else
    echo "✗ Hermes packaging failed"
    exit 1
fi

# Step 2: Package OpenClaw (Node.js)
echo ""
echo "Step 2: Packaging OpenClaw (Node.js)..."
echo "----------------------------------------"

# Check if pkg is installed
if ! command -v pkg &> /dev/null; then
    echo "Installing pkg..."
    npm install -g pkg
fi

# Install OpenClaw dependencies
echo "Installing OpenClaw dependencies..."
cd "$PROJECT_ROOT/openclaw"
npm install

# Build OpenClaw executable
echo "Building OpenClaw executable..."
TARGET="node18-win-x64"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    TARGET="node18-linux-x64"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    TARGET="node18-macos-x64"
fi

pkg client.js \
    --target "$TARGET" \
    --output "$BINARIES_DIR/openclaw" \
    --compress GZip

if [ -f "$BINARIES_DIR/openclaw.exe" ] || [ -f "$BINARIES_DIR/openclaw" ]; then
    echo "✓ OpenClaw packaged successfully"
else
    echo "✗ OpenClaw packaging failed"
    exit 1
fi

# Step 3: Verify binaries
echo ""
echo "Step 3: Verifying binaries..."
echo "----------------------------------------"

cd "$BINARIES_DIR"
ls -lh

echo ""
echo "=========================================="
echo "✓ Binary packaging completed!"
echo "=========================================="
echo ""
echo "Binaries location: $BINARIES_DIR"
echo ""
echo "Next steps:"
echo "  1. cd desktop"
echo "  2. npm run tauri build"
echo ""
