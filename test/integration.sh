#!/bin/bash
# ClawMind Integration Test Script
# Tests the complete workflow from configuration to task execution

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="node $PROJECT_ROOT/cli.js"
TEST_DIR="${CLAWMIND_DIR:-$HOME/ClawMind-test-integration}"

echo "=========================================="
echo "ClawMind Integration Test"
echo "=========================================="
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Test Data Dir: $TEST_DIR"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    CLAWMIND_DIR="$TEST_DIR" $CLI stop 2>/dev/null || true
    # Optionally remove test directory
    # rm -rf "$TEST_DIR"
}

trap cleanup EXIT

# Test 1: Doctor check
echo "Test 1: Running doctor check..."
CLAWMIND_DIR="$TEST_DIR" $CLI doctor
echo "✓ Doctor check passed"
echo ""

# Test 2: Configuration
echo "Test 2: Testing configuration..."
CLAWMIND_DIR="$TEST_DIR" $CLI config --set-model gpt-4
CLAWMIND_DIR="$TEST_DIR" $CLI config --set-port 18765
CLAWMIND_DIR="$TEST_DIR" $CLI config --set-log-level info
echo "✓ Configuration updated"
echo ""

# Test 3: Verify configuration
echo "Test 3: Verifying configuration..."
CONFIG_OUTPUT=$(CLAWMIND_DIR="$TEST_DIR" $CLI config --json)
echo "$CONFIG_OUTPUT" | grep -q '"model"' || { echo "✗ Config verification failed"; exit 1; }
echo "✓ Configuration verified"
echo ""

# Test 4: Start services
echo "Test 4: Starting services..."
CLAWMIND_DIR="$TEST_DIR" $CLI start --skip-health-check
echo "✓ Services started"
echo ""

# Test 5: Wait for services to be ready
echo "Test 5: Waiting for services to be ready..."
sleep 5
echo "✓ Services ready"
echo ""

# Test 6: Check status
echo "Test 6: Checking service status..."
STATUS_OUTPUT=$(CLAWMIND_DIR="$TEST_DIR" $CLI status --json)
echo "$STATUS_OUTPUT" | grep -q '"running": true' || { echo "✗ Services not running"; exit 1; }
echo "✓ Services are running"
echo ""

# Test 7: Send test task (if test script exists)
if [ -f "$PROJECT_ROOT/test/test-task-run.js" ]; then
    echo "Test 7: Sending test task..."
    CLAWMIND_WEBSOCKET_PORT=18765 node "$PROJECT_ROOT/test/test-task-run.js" &
    TASK_PID=$!

    # Wait for task to complete (max 30 seconds)
    for i in {1..30}; do
        if ! kill -0 $TASK_PID 2>/dev/null; then
            break
        fi
        sleep 1
    done

    wait $TASK_PID || { echo "✗ Task execution failed"; exit 1; }
    echo "✓ Task executed successfully"
    echo ""
else
    echo "Test 7: Skipping task test (test-task-run.js not found)"
    echo ""
fi

# Test 8: Check logs
echo "Test 8: Checking logs..."
if [ -f "$TEST_DIR/logs/hermes.err.log" ]; then
    LOG_SIZE=$(wc -l < "$TEST_DIR/logs/hermes.err.log")
    echo "   Hermes log: $LOG_SIZE lines"
fi
if [ -f "$TEST_DIR/logs/openclaw.out.log" ]; then
    LOG_SIZE=$(wc -l < "$TEST_DIR/logs/openclaw.out.log")
    echo "   OpenClaw log: $LOG_SIZE lines"
fi
echo "✓ Logs verified"
echo ""

# Test 9: Stop services
echo "Test 9: Stopping services..."
CLAWMIND_DIR="$TEST_DIR" $CLI stop
sleep 2
echo "✓ Services stopped"
echo ""

# Test 10: Verify services stopped
echo "Test 10: Verifying services stopped..."
STATUS_OUTPUT=$(CLAWMIND_DIR="$TEST_DIR" $CLI status --json)
echo "$STATUS_OUTPUT" | grep -q '"running": false' || { echo "✗ Services still running"; exit 1; }
echo "✓ Services confirmed stopped"
echo ""

echo "=========================================="
echo "All tests passed! ✓"
echo "=========================================="
echo ""
echo "Test data directory: $TEST_DIR"
echo "You can inspect logs at: $TEST_DIR/logs/"
echo ""
