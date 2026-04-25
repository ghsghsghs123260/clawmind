#!/bin/bash
# ClawMind 快速启动脚本

set -e

echo "=========================================="
echo "ClawMind AI Agent System"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install Node.js 18+"
    echo "Download: https://nodejs.org/"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python not found. Please install Python 3.8+"
    echo "Download: https://www.python.org/"
    exit 1
fi

echo "[OK] Node.js and Python found"
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
    echo ""
fi

if [ ! -d "hermes/__pycache__" ]; then
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt || pip install -r requirements.txt
    echo ""
fi

# 显示菜单
while true; do
    echo "=========================================="
    echo "ClawMind 启动菜单"
    echo "=========================================="
    echo ""
    echo "1. 启动 ClawMind (命令行模式)"
    echo "2. 启动桌面应用 (GUI 模式)"
    echo "3. 查看状态"
    echo "4. 停止服务"
    echo "5. 运行诊断"
    echo "6. 配置向导"
    echo "7. 退出"
    echo ""
    read -p "请选择 (1-7): " choice

    case $choice in
        1)
            echo ""
            echo "Starting ClawMind CLI..."
            node cli.js start
            ;;
        2)
            echo ""
            echo "Starting ClawMind Desktop App..."
            cd desktop
            if [ ! -d "node_modules" ]; then
                echo "Installing desktop dependencies..."
                npm install
            fi
            npm run tauri dev
            cd ..
            ;;
        3)
            echo ""
            node cli.js status
            echo ""
            read -p "Press Enter to continue..."
            ;;
        4)
            echo ""
            node cli.js stop
            echo ""
            read -p "Press Enter to continue..."
            ;;
        5)
            echo ""
            node cli.js doctor
            echo ""
            read -p "Press Enter to continue..."
            ;;
        6)
            echo ""
            node cli.js config --wizard
            echo ""
            read -p "Press Enter to continue..."
            ;;
        7)
            echo ""
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "[ERROR] Invalid choice"
            ;;
    esac
done
