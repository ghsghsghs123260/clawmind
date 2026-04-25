const WebSocket = require('ws');
const FileOperations = require('./modules/file-operations');
const { TerminalOperations } = require('./modules/terminal-operations');
const ClipboardOperations = require('./modules/clipboard-operations');
const BrowserOperations = require('./modules/browser-operations');
const MemorySystem = require('../memory');
const SkillSystem = require('../skills/adapter');
const NotificationSystem = require('../notifications');

class OpenClawClient {
  constructor(hermesUrl = 'ws://localhost:8765') {
    this.hermesUrl = hermesUrl;
    this.ws = null;
    this.connected = false;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectInterval = 60000;
    this.handlers = new Map();

    this.fileOps = new FileOperations();
    this.terminalOps = new TerminalOperations();
    this.clipboardOps = new ClipboardOperations();
    this.browserOps = new BrowserOperations();
    this.memory = new MemorySystem();
    this.skills = new SkillSystem();
    this.notifications = new NotificationSystem();

    this.skills.setOpenClawClient(this);

    // 桌面操作请求的 pending callbacks
    this.desktopPending = new Map();
    this.desktopRequestId = 0;

    this.registerDefaultHandlers();
    this.buildActionMap();
  }

  /**
   * 构建 action 映射表 —— 唯一的 action 分发定义
   */
  buildActionMap() {
    const f = this.fileOps;
    const t = this.terminalOps;
    const b = this.browserOps;
    const c = this.clipboardOps;
    const m = this.memory;
    const s = this.skills;
    const n = this.notifications;

    this.actionMap = {
      // 文件操作
      'file.read':        (p) => f.read(p),
      'file.write':       (p) => f.write(p),
      'file.delete':      (p) => f.delete(p),
      'file.list':        (p) => f.list(p),
      'file.search':      (p) => f.search(p),
      'file.copy':        (p) => f.copy(p),
      'file.move':        (p) => f.move(p),
      'file.info':        (p) => f.info(p),

      // 终端操作
      'terminal.exec':        (p) => t.exec(p),
      'terminal.exec_script': (p) => t.execScript(p),
      'terminal.get_cwd':     ()  => t.getCwd(),
      'terminal.set_cwd':     (p) => t.setCwd(p),
      'terminal.get_env':     (p) => t.getEnv(p),
      'terminal.set_env':     (p) => t.setEnv(p),

      // 浏览器操作
      'browser.launch':    (p) => b.launch(p),
      'browser.close':     ()  => b.close(),
      'browser.open':      (p) => b.open(p),
      'browser.click':     (p) => b.click(p),
      'browser.input':     (p) => b.input(p),
      'browser.extract':   (p) => b.extract(p),
      'browser.screenshot':(p) => b.screenshot(p),
      'browser.wait_for':  (p) => b.waitFor(p),
      'browser.evaluate':  (p) => b.evaluate(p),
      'browser.navigate':  (p) => b.navigate(p),

      // 桌面控制（转发到 Hermes/PyAutoGUI）
      'desktop.screenshot':       (p) => this.sendDesktopRequest('desktop.screenshot', p),
      'desktop.capture_screen':   (p) => this.sendDesktopRequest('desktop.screenshot', p),
      'desktop.mouse_move':       (p) => this.sendDesktopRequest('desktop.mouse_move', p),
      'desktop.mouse_click':      (p) => this.sendDesktopRequest('desktop.mouse_click', p),
      'desktop.mouse_drag':       (p) => this.sendDesktopRequest('desktop.mouse_drag', p),
      'desktop.mouse_scroll':     (p) => this.sendDesktopRequest('desktop.mouse_scroll', p),
      'desktop.key_press':        (p) => this.sendDesktopRequest('desktop.key_press', p),
      'desktop.key_hotkey':       (p) => this.sendDesktopRequest('desktop.key_hotkey', p),
      'desktop.key_type':         (p) => this.sendDesktopRequest('desktop.key_type', p),
      'desktop.find_image':       (p) => this.sendDesktopRequest('desktop.find_image', p),
      'desktop.get_screen_size':  (p) => this.sendDesktopRequest('desktop.get_screen_size', p),
      'desktop.get_mouse_position':(p) => this.sendDesktopRequest('desktop.get_mouse_position', p),
      'desktop.alert':            (p) => this.sendDesktopRequest('desktop.alert', p),

      // 剪贴板
      'clipboard.read':  ()  => c.read(),
      'clipboard.write': (p) => c.write(p),
      'clipboard.clear': ()  => c.clear(),

      // 记忆系统
      'memory.save_conversation': (p) => m.saveConversation(p.conversationId, p.messages),
      'memory.load_conversation': (p) => m.loadConversation(p.conversationId),
      'memory.list_conversations':() => m.listConversations(),
      'memory.save_preference':   (p) => m.savePreference(p.key, p.value),
      'memory.get_preference':    (p) => m.getPreference(p.key),
      'memory.save_task':         (p) => m.saveTask(p.taskId, p.taskData),
      'memory.list_tasks':        (p) => m.listTasks(p.filter),

      // Skills 系统
      'skill.get':     (p) => s.getSkill(p.skillId),
      'skill.list':    (p) => s.listSkills(p.filter),
      'skill.execute': (p) => s.executeSkill(p.skillId, p.params),
      'skill.create':  (p) => s.createSkill(p.skillData),
      'skill.search':  (p) => s.searchSkills(p.query),

      // 通知系统
      'notification.send':         (p) => n.send(p),
      'notification.task_complete':(p) => n.notifyTaskComplete(p.taskName, p.success),
      'notification.error':        (p) => n.notifyError(p.message),
    };
  }

  // ==================== 连接管理 ====================

  connect() {
    console.log(`[OpenClaw] 连接到 Hermes: ${this.hermesUrl}`);

    this.ws = new WebSocket(this.hermesUrl);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[OpenClaw] ✓ 已连接到 Hermes Server');
      this.send({
        type: 'register',
        client: 'openclaw',
        capabilities: [
          'file_operations',
          'terminal_commands',
          'browser_automation',
          'desktop_control',
          'clipboard_operations'
        ]
      });
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      this.connected = false;
      // Reject all pending desktop requests on disconnect
      for (const [id, pending] of this.desktopPending) {
        clearTimeout(pending.timer);
        pending.resolve({ success: false, error: 'Connection closed' });
      }
      this.desktopPending.clear();
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectInterval);
      console.log(`[OpenClaw] 连接已断开，${(delay / 1000).toFixed(0)}s 后重连 (attempt ${this.reconnectAttempts})...`);
      setTimeout(() => this.connect(), delay);
    });

    this.ws.on('error', (error) => {
      console.error('[OpenClaw] WebSocket 错误:', error.message);
    });
  }

  async handleMessage(message) {
    try {
      const data = JSON.parse(message);
      console.log(`[OpenClaw] 收到消息: type=${data.type}`);

      if (data.type === 'command' && data.action) {
        this.executeCommand(data);
      } else if (data.type === 'desktop.execute') {
        const result = await this.executeAction(data.action, data.params || {});
        this.send({ type: 'desktop.result', id: data.id, ...result });
      } else if (data.type === 'desktop.result' || data.type === 'desktop.execute_response') {
        const pending = this.desktopPending.get(data.id);
        if (pending) {
          this.desktopPending.delete(data.id);
          clearTimeout(pending.timer);
          pending.resolve(data);
        }
      } else if (this.handlers.has(data.type)) {
        this.handlers.get(data.type)(data);
      } else {
        console.log(`[OpenClaw] 未知消息类型: ${data.type}`);
      }
    } catch (error) {
      console.error('[OpenClaw] 消息解析错误:', error.message);
    }
  }

  // ==================== 统一的 action 执行入口 ====================

  async executeAction(action, params = {}) {
    console.log(`[OpenClaw] 执行 action: ${action}`);

    const handler = this.actionMap[action];
    if (!handler) {
      return { success: false, error: `Unknown action: ${action}` };
    }

    try {
      const result = await handler(params || {});
      // If handler already returns a result with 'success' key, use it directly
      if (result && typeof result === 'object' && 'success' in result) {
        return result;
      }
      return { success: true, result };
    } catch (error) {
      console.error(`[OpenClaw] Action 执行失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行 Hermes 下发的 command（走 actionMap，返回 command_result 响应）
   */
  async executeCommand(command) {
    const { id, action, params } = command;
    const { success, result, error } = await this.executeAction(action, params);

    this.send({
      type: 'command_result',
      id,
      success,
      ...(success ? { result } : { error }),
    });
  }

  // ==================== 桌面操作 ====================

  sendDesktopRequest(action, params = {}) {
    return new Promise((resolve) => {
      const reqId = `desktop_${++this.desktopRequestId}`;
      const timer = setTimeout(() => {
        this.desktopPending.delete(reqId);
        resolve({ success: false, error: `Desktop request timeout: ${action}` });
      }, 30000);

      this.desktopPending.set(reqId, { resolve, timer });
      this.send({ type: 'desktop.execute', id: reqId, action, params });
    });
  }

  // ==================== 消息收发 ====================

  registerDefaultHandlers() {
    this.handlers.set('ping', (data) => {
      this.send({ type: 'pong', id: data.id });
    });
    this.handlers.set('echo', (data) => {
      console.log('[OpenClaw] Echo:', data);
    });
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
    console.log(`[OpenClaw] 注册处理器: ${type}`);
  }

  send(data) {
    if (!this.connected || !this.ws) {
      console.warn('[OpenClaw] 未连接到 Hermes Server，消息被丢弃:', data.type || 'unknown');
      return;
    }
    try {
      this.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error('[OpenClaw] 发送消息失败:', error.message);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
      console.log('[OpenClaw] 已断开连接');
    }
  }
}

if (require.main === module) {
  const hermesUrl = process.env.CLAWMIND_WEBSOCKET_URL || 'ws://localhost:8765';
  const client = new OpenClawClient(hermesUrl);
  client.connect();
}

module.exports = OpenClawClient;
