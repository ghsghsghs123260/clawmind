# ClawMind

> **AI Agent System** — OpenClaw (hands) + Hermes Agent (brain)

**Version:** 5.0.0 | **License:** MIT

---

## Overview

ClawMind combines two AI Agent frameworks:

| Component | Role | Language |
|-----------|------|----------|
| **Hermes Agent** | Brain — thinking, planning, memory | Python |
| **OpenClaw** | Hands — execution, tools, device control | Node.js |

They communicate via **WebSocket (port 8765)** using a structured **JSON instruction protocol**.

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure API Key

```bash
# Interactive configuration wizard
node cli.js config --wizard

# Or set API key directly
node cli.js config --set apiKey YOUR_API_KEY
node cli.js config --set model gpt-4
```

### 3. Start Services

```bash
# Check system health first
node cli.js doctor

# Start Hermes + OpenClaw
node cli.js start

# Check status
node cli.js status
```

### 4. Use Desktop UI (Optional)

```bash
cd desktop
npm install
npm run dev
```

Open browser at `http://localhost:5173`

---

## CLI Commands

```bash
node cli.js --help                    # Show help
node cli.js status                    # Check if Hermes & OpenClaw are running
node cli.js start                     # Start services
node cli.js stop                      # Stop services
node cli.js restart                   # Restart services
node cli.js doctor                    # Run diagnostics
node cli.js doctor --fix              # Auto-fix issues
node cli.js config                    # Show configuration
node cli.js config --wizard           # Interactive setup
node cli.js config --set apiKey KEY   # Set API key
node cli.js config --set model MODEL  # Set model
node cli.js log                       # View recent logs
```

---

## Architecture

```
User Input (Desktop UI / CLI)
    │
    ▼
Hermes Server (WebSocket :8765)
    │
    ├─→ Planner (LLM) → Generate multi-step plan
    │
    ├─→ Executor → Execute plan step by step
    │       │
    │       ▼
    └─→ OpenClaw Client
          • File operations (read/write/delete/list/search/copy/move/info)
          • Terminal operations (exec/script/cwd/env)
          • Browser automation (Puppeteer: launch/click/input/screenshot)
          • Desktop control (mouse/keyboard/screenshot)
          • Clipboard operations (read/write/clear)
          • Memory system (conversations/preferences/tasks)
          • Skill system (create/execute/search)
          • Notifications
    │
    ▼
Results returned to user
```

---

## Data Directory

Default: `~/ClawMind/` (or `C:/Users/<you>/ClawMind/` on Windows)

Override with environment variable: `CLAWMIND_DIR=/path/to/data`

```
ClawMind/
├── config.json          # Main configuration
├── logs/
│   ├── hermes.out.log   # Hermes stdout
│   ├── hermes.err.log   # Hermes stderr
│   ├── openclaw.out.log # OpenClaw stdout
│   └── openclaw.err.log # OpenClaw stderr
├── memory/              # Memory system data
├── skills/              # Skill definitions
└── runtime/             # Process management
```

---

## Configuration

Configuration is stored in `config.json`:

```json
{
  "provider": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4",
  "apiEndpoint": "https://api.openai.com/v1",
  "authHeaderName": "Authorization",
  "authHeaderValuePrefix": "Bearer ",
  "websocketPort": 8765
}
```

### Supported Providers

- **OpenAI**: `provider: "openai"`, endpoint: `https://api.openai.com/v1`
- **Anthropic**: `provider: "anthropic"`, endpoint: `https://api.anthropic.com/v1`
- **Custom**: Set custom `apiEndpoint` and `authHeaderName`

---

## Task Execution Protocol

### 1. Send Task

```javascript
ws.send(JSON.stringify({
  type: 'task.run',
  id: 'task_123',
  input: '请读取 /path/to/file.txt 并统计行数'
}));
```

### 2. Hermes Generates Plan

```json
{
  "goal": "读取文件并统计行数",
  "steps": [
    {
      "action": "file.read",
      "params": { "path": "/path/to/file.txt" },
      "reason": "读取文件内容"
    },
    {
      "action": "terminal.exec",
      "params": { "command": "wc -l /path/to/file.txt" },
      "reason": "统计行数"
    }
  ]
}
```

### 3. Executor Runs Steps

Each step is sent to OpenClaw as a `command`:

```json
{
  "type": "command",
  "id": "task_123:step:1",
  "action": "file.read",
  "params": { "path": "/path/to/file.txt" }
}
```

### 4. OpenClaw Returns Results

```json
{
  "type": "command_result",
  "id": "task_123:step:1",
  "success": true,
  "result": { "content": "file content..." }
}
```

### 5. Final Result

```json
{
  "type": "task.result",
  "id": "task_123",
  "success": true,
  "plan": { ... },
  "stepResults": [ ... ]
}
```

---

## Supported Actions

### File Operations (8)
- `file.read` - Read file content
- `file.write` - Write to file
- `file.delete` - Delete file
- `file.list` - List directory
- `file.search` - Search files by pattern
- `file.copy` - Copy file
- `file.move` - Move/rename file
- `file.info` - Get file metadata

### Terminal Operations (6)
- `terminal.exec` - Execute command
- `terminal.exec_script` - Execute script
- `terminal.get_cwd` - Get current directory
- `terminal.set_cwd` - Change directory
- `terminal.get_env` - Get environment variable
- `terminal.set_env` - Set environment variable

### Browser Operations (10)
- `browser.launch` - Launch browser
- `browser.close` - Close browser
- `browser.open` - Open URL
- `browser.click` - Click element
- `browser.input` - Input text
- `browser.extract` - Extract data
- `browser.screenshot` - Take screenshot
- `browser.wait_for` - Wait for element
- `browser.evaluate` - Execute JavaScript
- `browser.navigate` - Navigate (back/forward/reload)

### Desktop Operations (11)
- `desktop.screenshot` - Take screenshot
- `desktop.mouse_move` - Move mouse
- `desktop.mouse_click` - Click mouse
- `desktop.mouse_drag` - Drag mouse
- `desktop.key_press` - Press key
- `desktop.key_combo` - Key combination
- `desktop.type_text` - Type text
- `desktop.get_window_list` - List windows
- `desktop.focus_window` - Focus window
- `desktop.get_screen_size` - Get screen size
- `desktop.get_mouse_position` - Get mouse position

### Clipboard Operations (3)
- `clipboard.read` - Read clipboard
- `clipboard.write` - Write to clipboard
- `clipboard.clear` - Clear clipboard

### Memory Operations (7)
- `memory.save_conversation` - Save conversation
- `memory.load_conversation` - Load conversation
- `memory.list_conversations` - List conversations
- `memory.save_preference` - Save preference
- `memory.get_preference` - Get preference
- `memory.save_task` - Save task
- `memory.list_tasks` - List tasks

### Skill Operations (5)
- `skill.get` - Get skill by ID
- `skill.list` - List all skills
- `skill.execute` - Execute skill
- `skill.create` - Create new skill
- `skill.search` - Search skills

### Notification Operations (3)
- `notification.send` - Send notification
- `notification.task_complete` - Task complete notification
- `notification.error` - Error notification

**Total: 53 actions**

---

## Development

### Project Structure

```
clawmind/
├── cli.js                 # CLI entry point
├── src/
│   ├── commands/          # CLI commands (doctor/start/stop/config)
│   └── utils/             # Utilities (config/process/health)
├── hermes/
│   ├── server.py          # WebSocket server
│   ├── planner.py         # LLM-based planner
│   └── executor.py        # Step executor
├── openclaw/
│   ├── client.js          # WebSocket client
│   └── modules/           # Action modules
├── desktop/               # Vue3 desktop UI
├── memory/                # Memory system
├── skills/                # Skill system
├── notifications/         # Notification system
└── config/                # Default configuration
```

### Running Tests

```bash
# End-to-end test
node test-task-run.js

# Or with custom port
CLAWMIND_WEBSOCKET_PORT=18765 node test-task-run.js
```

---

## Troubleshooting

### Services won't start

```bash
# Run diagnostics
node cli.js doctor

# Check logs
node cli.js log

# Check if port is in use
netstat -ano | grep 8765  # Linux/Mac
netstat -ano | findstr 8765  # Windows
```

### WebSocket connection failed

1. Check if Hermes is running: `node cli.js status`
2. Check firewall settings
3. Verify port in config: `node cli.js config`

### API errors

1. Verify API key: `node cli.js config`
2. Check API endpoint and model
3. View Hermes logs: `tail -f ~/ClawMind/logs/hermes.err.log`

---

## License

MIT

---

## Links

- [Project Documentation](./docs/)
- [API Reference](./docs/api.md)
- [Contributing Guide](./CONTRIBUTING.md)
