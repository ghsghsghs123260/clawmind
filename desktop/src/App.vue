<template>
  <!-- Setup Wizard (shown on first run) -->
  <SetupWizard v-if="showSetupWizard" @complete="onSetupComplete" />

  <!-- Main App (shown after setup) -->
  <div v-else id="app" class="app-container">
    <!-- 顶部状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">Hermes:</span>
        <span :class="['status-indicator', hermesStatus]">{{ hermesStatus }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">OpenClaw:</span>
        <span :class="['status-indicator', openclawStatus]">{{ openclawStatus }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">WebSocket:</span>
        <span :class="['status-indicator', wsStatus]">{{ wsConnected ? 'connected' : 'disconnected' }}</span>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧：对话窗口 -->
      <div class="chat-panel">
        <div class="chat-header">
          <h2>对话窗口</h2>
        </div>
        <div class="chat-messages" ref="messagesContainer">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message', msg.type]"
          >
            <div class="message-header">
              <span class="message-sender">{{ msg.sender }}</span>
              <span class="message-time">{{ msg.time }}</span>
            </div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
        </div>
        <div class="chat-input">
          <textarea
            v-model="inputMessage"
            placeholder="输入消息..."
            @keydown.ctrl.enter="sendMessage"
          ></textarea>
          <button @click="sendMessage" class="send-button">发送</button>
        </div>
      </div>

      <!-- 右侧：任务面板和日志 -->
      <div class="right-panel">
        <!-- 任务面板 -->
        <div class="task-panel">
          <div class="panel-header">
            <h3>任务列表</h3>
          </div>
          <div class="task-list">
            <div
              v-for="(task, index) in tasks"
              :key="index"
              :class="['task-card', task.status]"
            >
              <div class="task-title">{{ task.title }}</div>
              <div class="task-steps">
                <div
                  v-for="(step, stepIndex) in task.steps"
                  :key="stepIndex"
                  :class="['task-step', step.status]"
                >
                  <span class="step-icon">{{ getStepIcon(step.status) }}</span>
                  <span class="step-text">{{ step.text }}</span>
                </div>
              </div>
              <div class="task-status">{{ getTaskStatusText(task.status) }}</div>
            </div>
          </div>
        </div>

        <!-- 日志面板 -->
        <div class="log-panel">
          <div class="panel-header">
            <h3>日志</h3>
            <div class="log-controls">
              <select v-model="logLevel">
                <option value="all">全部</option>
                <option value="info">信息</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
              </select>
              <button @click="clearLogs" class="clear-button">清空</button>
            </div>
          </div>
          <div class="log-content" ref="logContainer">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              :class="['log-entry', log.level]"
            >
              <span class="log-time">{{ log.time }}</span>
              <span class="log-level">{{ log.level.toUpperCase() }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部 Token 计算 -->
    <div class="footer">
      <div class="token-info">
        <span>输入 Token: {{ tokenStats.input }}</span>
        <span>输出 Token: {{ tokenStats.output }}</span>
        <span>总计: {{ tokenStats.total }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import SetupWizard from './components/SetupWizard.vue';

// Setup wizard state
const showSetupWizard = ref(false);

// WebSocket 连接
let ws: WebSocket | null = null;
let wsPort = 8765;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

// 状态
const hermesStatus = ref('stopped');
const openclawStatus = ref('stopped');
const wsConnected = ref(false);
const wsStatus = computed(() => wsConnected.value ? 'connected' : 'disconnected');

// 消息
interface Message {
  type: 'user' | 'assistant' | 'system';
  sender: string;
  content: string;
  time: string;
}

const messages = ref<Message[]>([
  {
    type: 'system',
    sender: 'System',
    content: '欢迎使用 ClawMind 智能体系统',
    time: new Date().toLocaleTimeString()
  }
]);

const inputMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

// 任务
interface TaskStep {
  text: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface Task {
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  steps: TaskStep[];
}

const tasks = ref<Task[]>([
  {
    title: '示例任务',
    status: 'pending',
    steps: [
      { text: '步骤 1: 初始化', status: 'pending' },
      { text: '步骤 2: 执行操作', status: 'pending' },
      { text: '步骤 3: 完成', status: 'pending' }
    ]
  }
]);

// 日志
interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const logs = ref<LogEntry[]>([
  {
    time: new Date().toLocaleTimeString(),
    level: 'info',
    message: 'ClawMind 系统初始化'
  }
]);

const logLevel = ref('all');
const logContainer = ref<HTMLElement | null>(null);

const filteredLogs = computed(() => {
  if (logLevel.value === 'all') {
    return logs.value;
  }
  return logs.value.filter(log => log.level === logLevel.value);
});

// Token 统计
const tokenStats = ref({
  input: 0,
  output: 0,
  total: 0
});

// 方法
const connectWebSocket = () => {
  try {
    ws = new WebSocket(`ws://localhost:${wsPort}`);

    ws.onopen = () => {
      wsConnected.value = true;
      reconnectAttempts = 0;
      addLog('info', `已连接到 Hermes Server (端口 ${wsPort})`);

      // 发送注册消息
      ws?.send(JSON.stringify({
        type: 'register',
        client: 'desktop-ui'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error('解析消息失败:', err);
      }
    };

    ws.onerror = (error) => {
      addLog('error', 'WebSocket 连接错误');
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      wsConnected.value = false;
      addLog('warn', 'WebSocket 连接已断开');

      // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
      reconnectAttempts++;
      const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 30000);
      addLog('info', `${(delay / 1000).toFixed(0)}s 后重连 (attempt ${reconnectAttempts})...`);

      reconnectTimer = setTimeout(() => {
        if (!wsConnected.value) {
          connectWebSocket();
        }
      }, delay);
    };
  } catch (err) {
    addLog('error', `连接失败: ${err}`);
  }
};

const handleMessage = (data: any) => {
  switch (data.type) {
    case 'registered':
      addLog('info', '已注册到 Hermes Server');
      break;

    case 'task.result':
      handleTaskResult(data);
      break;

    case 'command':
      addLog('info', `执行命令: ${data.action}`);
      break;

    case 'status':
      if (data.services) {
        hermesStatus.value = data.services.hermes || 'stopped';
        openclawStatus.value = data.services.openclaw || 'stopped';
      }
      break;

    default:
      console.log('收到消息:', data);
  }
};

const handleTaskResult = (data: any) => {
  if (data.success && data.plan) {
    const task: Task = {
      title: data.plan.goal || '任务',
      status: 'completed',
      steps: data.plan.steps.map((step: any, index: number) => ({
        text: `${step.action}: ${step.reason || ''}`,
        status: data.stepResults?.[index]?.result?.success ? 'completed' : 'error'
      }))
    };
    tasks.value.push(task);

    addLog('info', `任务完成: ${task.title}`);

    messages.value.push({
      type: 'assistant',
      sender: 'ClawMind',
      content: `任务已完成：${task.title}\n执行了 ${task.steps.length} 个步骤`,
      time: new Date().toLocaleTimeString()
    });
  } else {
    addLog('error', `任务失败: ${data.error || '未知错误'}`);
  }

  scrollToBottom(messagesContainer.value);
};

const addLog = (level: 'info' | 'warn' | 'error', message: string) => {
  logs.value.push({
    time: new Date().toLocaleTimeString(),
    level,
    message
  });
  nextTick(() => scrollToBottom(logContainer.value));
};

const sendMessage = () => {
  if (!inputMessage.value.trim()) return;

  const userMessage = inputMessage.value;
  messages.value.push({
    type: 'user',
    sender: 'User',
    content: userMessage,
    time: new Date().toLocaleTimeString()
  });

  // 发送 task.run 到 Hermes
  if (ws && wsConnected.value) {
    const taskId = `task_${Date.now()}`;
    ws.send(JSON.stringify({
      type: 'task.run',
      id: taskId,
      input: userMessage
    }));

    addLog('info', `发送任务: ${taskId}`);

    messages.value.push({
      type: 'system',
      sender: 'System',
      content: '任务已提交，等待执行...',
      time: new Date().toLocaleTimeString()
    });
  } else {
    messages.value.push({
      type: 'system',
      sender: 'System',
      content: '未连接到 Hermes Server',
      time: new Date().toLocaleTimeString()
    });
  }

  inputMessage.value = '';
  nextTick(() => scrollToBottom(messagesContainer.value));
};

const getStepIcon = (status: string) => {
  switch (status) {
    case 'completed': return '✓';
    case 'running': return '⟳';
    case 'error': return '✗';
    default: return '○';
  }
};

const getTaskStatusText = (status: string) => {
  switch (status) {
    case 'completed': return '已完成';
    case 'running': return '执行中';
    case 'error': return '失败';
    default: return '等待中';
  }
};

const clearLogs = () => {
  logs.value = [];
};

const scrollToBottom = (element: HTMLElement | null) => {
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
};

// Setup wizard handlers
const onSetupComplete = () => {
  showSetupWizard.value = false;
  // Reload to apply new configuration
  window.location.reload();
};

const checkFirstRun = () => {
  const setupCompleted = localStorage.getItem('clawmind_setup_completed');
  if (setupCompleted !== 'true') {
    showSetupWizard.value = true;
  }
};

// 初始化
onMounted(async () => {
  console.log('ClawMind Desktop UI 已加载');

  // Check if this is first run
  checkFirstRun();

  // Only connect WebSocket if setup is completed
  if (!showSetupWizard.value) {
    // Load port from saved config
    try {
      const config: any = await invoke('load_config');
      if (config?.websocketPort) {
        wsPort = config.websocketPort;
      }
    } catch {
      // Config not found, use default port 8765
    }

    // Wait for backend services to start (Rust auto-starts with 1s delay)
    setTimeout(() => {
      connectWebSocket();
    }, 2500);
  }
});

// Cleanup WebSocket on unmount
onUnmounted(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  width: 100vw;
  height: 100vh;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* 状态栏 */
.status-bar {
  display: flex;
  gap: 20px;
  padding: 10px 20px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-size: 12px;
  color: #858585;
}

.status-indicator {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
}

.status-indicator.running,
.status-indicator.connected {
  background: #0e639c;
  color: #fff;
}

.status-indicator.stopped,
.status-indicator.disconnected {
  background: #3e3e42;
  color: #858585;
}

/* 主内容 */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 对话窗口 */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #3e3e42;
}

.chat-header {
  padding: 15px 20px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.chat-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  margin-bottom: 20px;
  padding: 12px;
  border-radius: 6px;
}

.message.user {
  background: #0e639c;
  margin-left: 20%;
}

.message.assistant {
  background: #2d2d30;
  margin-right: 20%;
}

.message.system {
  background: #3e3e42;
  text-align: center;
  font-size: 12px;
  color: #858585;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.message-sender {
  font-weight: 600;
}

.message-time {
  color: #858585;
}

.message-content {
  line-height: 1.5;
}

.chat-input {
  display: flex;
  gap: 10px;
  padding: 15px 20px;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.chat-input textarea {
  flex: 1;
  padding: 10px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  resize: none;
  font-family: inherit;
  height: 60px;
}

.send-button {
  padding: 10px 20px;
  background: #0e639c;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

.send-button:hover {
  background: #1177bb;
}

/* 右侧面板 */
.right-panel {
  width: 400px;
  display: flex;
  flex-direction: column;
}

.task-panel,
.log-panel {
  display: flex;
  flex-direction: column;
}

.task-panel {
  flex: 1;
  border-bottom: 1px solid #3e3e42;
}

.log-panel {
  flex: 1;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.log-controls {
  display: flex;
  gap: 10px;
}

.log-controls select {
  padding: 4px 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #d4d4d4;
  font-size: 12px;
}

.clear-button {
  padding: 4px 12px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  color: #d4d4d4;
  cursor: pointer;
  font-size: 12px;
}

.clear-button:hover {
  background: #505050;
}

/* 任务列表 */
.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.task-card {
  padding: 12px;
  margin-bottom: 10px;
  background: #2d2d30;
  border-radius: 6px;
  border-left: 3px solid #3e3e42;
}

.task-card.running {
  border-left-color: #0e639c;
}

.task-card.completed {
  border-left-color: #4ec9b0;
}

.task-card.error {
  border-left-color: #f48771;
}

.task-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.task-steps {
  margin-bottom: 10px;
}

.task-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.step-icon {
  width: 16px;
  text-align: center;
}

.task-step.completed .step-icon {
  color: #4ec9b0;
}

.task-step.running .step-icon {
  color: #0e639c;
}

.task-step.error .step-icon {
  color: #f48771;
}

.task-status {
  font-size: 12px;
  color: #858585;
}

/* 日志 */
.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
}

.log-entry {
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 3px;
}

.log-entry.info {
  background: #2d2d30;
}

.log-entry.warn {
  background: #3e3e42;
  color: #dcdcaa;
}

.log-entry.error {
  background: #3e3e42;
  color: #f48771;
}

.log-time {
  color: #858585;
  margin-right: 8px;
}

.log-level {
  font-weight: 600;
  margin-right: 8px;
}

/* 底部 */
.footer {
  padding: 8px 20px;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.token-info {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #858585;
}
</style>
