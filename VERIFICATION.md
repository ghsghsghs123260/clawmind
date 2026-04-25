# ClawMind 系统验证指南

本指南将帮助你逐步验证 ClawMind 系统的所有功能。

## 前置准备

### 1. 安装 Python 依赖

```bash
cd C:\Users\14127\Desktop\clawmind\hermes
pip install websockets pyautogui pillow
```

### 2. 安装 Node.js 依赖

```bash
# OpenClaw 依赖
cd C:\Users\14127\Desktop\clawmind\openclaw
npm install

# Notifications 依赖
cd C:\Users\14127\Desktop\clawmind\notifications
npm install
```

### 3. 验证环境

```bash
cd C:\Users\14127\Desktop\clawmind\cli
node bin/clawmind.js doctor
```

预期输出：所有检查项应该显示 ✓

---

## 阶段一：基础设施验证

### 1.1 测试 Help 命令

```bash
cd C:\Users\14127\Desktop\clawmind\cli
node bin/clawmind.js help
```

**预期结果**：显示所有可用命令列表

### 1.2 测试 Status 命令

```bash
node bin/clawmind.js status
```

**预期结果**：显示系统状态（未启动）

### 1.3 测试 Doctor 诊断

```bash
node bin/clawmind.js doctor
```

**预期结果**：
- ✓ Node.js 版本检查通过
- ✓ Python 版本检查通过
- ✓ 端口 8765 可用
- ✓ 数据目录权限正常

---

## 阶段二：配置管理验证

### 2.1 运行配置向导

```bash
node bin/clawmind.js config
```

**操作步骤**：
1. 选择 AI 提供商（选择 OpenAI）
2. 选择模型（选择 gpt-4）
3. 输入 API Key（输入测试 Key：sk-test1234567890abcdefghijklmnopqrstuvwxyz）
4. 启用 Hermes Agent（选择 Yes）
5. 启用 OpenClaw（选择 Yes）
6. 数据路径（使用默认）
7. 日志路径（使用默认）
8. WebSocket 端口（使用默认 8765）
9. 其他选项使用默认

**预期结果**：配置保存成功，生成 `config/config.json`

### 2.2 验证配置文件

```bash
type C:\Users\14127\Desktop\clawmind\config\config.json
```

**预期结果**：显示完整的配置 JSON

---

## 阶段三：核心通信验证

### 3.1 启动系统

```bash
node bin/clawmind.js start
```

**预期结果**：
```
=== 启动 ClawMind 系统 ===

步骤 1/4: 环境检查
✓ 环境检查通过

步骤 2/4: 配置检查
✓ 配置验证通过

步骤 3/4: 启动核心组件

启动 Hermes Agent...
✓ Hermes Agent 已启动 (PID: xxxx)
  WebSocket: ws://localhost:8765

启动 OpenClaw...
✓ OpenClaw 已启动 (PID: xxxx)

=== ClawMind Core 启动完成 ===

系统状态：

  ● Hermes Agent:  running (PID: xxxx)
  ● OpenClaw:      running (PID: xxxx)
  ○ 桌面端:        not_implemented

按 Ctrl+C 停止系统
```

**验证点**：
- Hermes 进程启动成功
- OpenClaw 进程启动成功
- 看到 WebSocket 连接日志

### 3.2 测试 WebSocket 通信

**打开新终端**，创建测试脚本：

```bash
cd C:\Users\14127\Desktop\clawmind
```

创建文件 `test-websocket.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('✓ 连接成功');
  
  // 发送 ping
  ws.send(JSON.stringify({ type: 'ping', id: '1' }));
});

ws.on('message', (data) => {
  console.log('收到消息:', data.toString());
  ws.close();
});

ws.on('error', (error) => {
  console.error('✗ 连接失败:', error.message);
});
```

运行测试：

```bash
node test-websocket.js
```

**预期结果**：
```
✓ 连接成功
收到消息: {"type":"pong","id":"1","timestamp":"..."}
```

### 3.3 停止系统

回到启动系统的终端，按 `Ctrl+C`

**预期结果**：
```
收到停止信号...

=== ClawMind Core 停止中 ===

停止 OpenClaw...
✓ OpenClaw 已停止

停止 Hermes Agent...
✓ Hermes Agent 已停止

✓ ClawMind 系统已停止
```

---

## 阶段四：执行能力验证

### 4.1 准备测试环境

重新启动系统：

```bash
cd C:\Users\14127\Desktop\clawmind\cli
node bin/clawmind.js start
```

### 4.2 测试文件操作

创建测试脚本 `test-file-ops.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', async () => {
  console.log('=== 测试文件操作 ===\n');
  
  // 测试 1: 写入文件
  console.log('1. 测试写入文件...');
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'file.write',
    params: {
      path: 'C:/Users/14127/Desktop/test.txt',
      content: 'Hello ClawMind!'
    }
  }));
  
  // 等待响应后测试读取
  setTimeout(() => {
    console.log('2. 测试读取文件...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '2',
      action: 'file.read',
      params: {
        path: 'C:/Users/14127/Desktop/test.txt'
      }
    }));
  }, 1000);
  
  // 测试删除
  setTimeout(() => {
    console.log('3. 测试删除文件...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '3',
      action: 'file.delete',
      params: {
        path: 'C:/Users/14127/Desktop/test.txt'
      }
    }));
  }, 2000);
  
  // 关闭连接
  setTimeout(() => {
    ws.close();
  }, 3000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log(`✓ 指令 ${msg.id} 执行成功:`, msg.result);
  }
});
```

运行测试：

```bash
node test-file-ops.js
```

**预期结果**：
```
=== 测试文件操作 ===

1. 测试写入文件...
✓ 指令 1 执行成功: { success: true, path: '...', size: 15, mode: 'write' }
2. 测试读取文件...
✓ 指令 2 执行成功: { success: true, path: '...', content: 'Hello ClawMind!', size: 15 }
3. 测试删除文件...
✓ 指令 3 执行成功: { success: true, path: '...', type: 'file' }
```

### 4.3 测试终端命令

创建测试脚本 `test-terminal.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('=== 测试终端命令 ===\n');
  
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'terminal.exec',
    params: {
      command: 'echo Hello from ClawMind'
    }
  }));
  
  setTimeout(() => ws.close(), 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log('✓ 命令执行成功');
    console.log('输出:', msg.result.stdout.trim());
  }
});

ws.on('error', (error) => {
  console.error('✗ 错误:', error.message);
});
```

运行测试：

```bash
node test-terminal.js
```

**预期结果**：
```
=== 测试终端命令 ===

✓ 命令执行成功
输出: Hello from ClawMind
```

### 4.4 测试剪贴板操作

创建测试脚本 `test-clipboard.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('=== 测试剪贴板操作 ===\n');
  
  // 写入剪贴板
  console.log('1. 写入剪贴板...');
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'clipboard.write',
    params: {
      content: 'ClawMind Test'
    }
  }));
  
  // 读取剪贴板
  setTimeout(() => {
    console.log('2. 读取剪贴板...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '2',
      action: 'clipboard.read',
      params: {}
    }));
  }, 1000);
  
  setTimeout(() => ws.close(), 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log(`✓ 指令 ${msg.id} 执行成功:`, msg.result);
  }
});

ws.on('error', (error) => {
  console.error('✗ 错误:', error.message);
});
```

运行测试：

```bash
node test-clipboard.js
```

**预期结果**：
```
=== 测试剪贴板操作 ===

1. 写入剪贴板...
✓ 指令 1 执行成功: { success: true, length: 14 }
2. 读取剪贴板...
✓ 指令 2 执行成功: { success: true, content: 'ClawMind Test', length: 14 }
```

---

## 阶段五：界面 UI 验证

### 5.1 安装 Rust（如果未安装）

访问：https://www.rust-lang.org/tools/install

或跳过此步骤，直接查看 UI 代码。

### 5.2 运行桌面端（需要 Rust）

```bash
cd C:\Users\14127\Desktop\clawmind\desktop
npm run dev
```

**预期结果**：
- Tauri 窗口打开
- 显示深色主题界面
- 顶部状态栏显示组件状态
- 左侧对话窗口可用
- 右侧任务面板和日志面板可见

### 5.3 验证 UI 组件

**手动测试**：
1. 在输入框输入消息，点击发送
2. 查看消息是否显示在对话窗口
3. 检查任务卡片是否正确显示
4. 测试日志筛选功能
5. 验证 Token 统计显示

---

## 阶段六：高级功能验证

### 6.1 测试记忆系统

创建测试脚本 `test-memory.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('=== 测试记忆系统 ===\n');
  
  // 保存对话
  console.log('1. 保存对话...');
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'memory.save_conversation',
    params: {
      conversationId: 'test_conv_001',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
    }
  }));
  
  // 列出对话
  setTimeout(() => {
    console.log('2. 列出对话...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '2',
      action: 'memory.list_conversations',
      params: {}
    }));
  }, 1000);
  
  // 保存偏好
  setTimeout(() => {
    console.log('3. 保存用户偏好...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '3',
      action: 'memory.save_preference',
      params: {
        key: 'theme',
        value: 'dark'
      }
    }));
  }, 2000);
  
  setTimeout(() => ws.close(), 3000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log(`✓ 指令 ${msg.id} 执行成功`);
    if (msg.result.conversations) {
      console.log(`  找到 ${msg.result.count} 个对话`);
    }
  }
});

ws.on('error', (error) => {
  console.error('✗ 错误:', error.message);
});
```

运行测试：

```bash
node test-memory.js
```

**预期结果**：
```
=== 测试记忆系统 ===

1. 保存对话...
✓ 指令 1 执行成功
2. 列出对话...
✓ 指令 2 执行成功
  找到 1 个对话
3. 保存用户偏好...
✓ 指令 3 执行成功
```

验证数据文件：

```bash
dir C:\Users\14127\Desktop\clawmind\data\memory\conversations
type C:\Users\14127\Desktop\clawmind\data\memory\conversations\test_conv_001.json
```

### 6.2 测试技能系统

创建测试脚本 `test-skills.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('=== 测试技能系统 ===\n');
  
  // 列出技能
  console.log('1. 列出所有技能...');
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'skill.list',
    params: {}
  }));
  
  // 获取技能详情
  setTimeout(() => {
    console.log('2. 获取技能详情...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '2',
      action: 'skill.get',
      params: {
        skillId: 'file_backup'
      }
    }));
  }, 1000);
  
  setTimeout(() => ws.close(), 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log(`✓ 指令 ${msg.id} 执行成功`);
    if (msg.result.skills) {
      console.log(`  找到 ${msg.result.count} 个技能:`);
      msg.result.skills.forEach(s => {
        console.log(`    - ${s.name} (${s.id})`);
      });
    }
    if (msg.result.skill) {
      console.log(`  技能: ${msg.result.skill.name}`);
      console.log(`  步骤数: ${msg.result.skill.steps.length}`);
    }
  }
});

ws.on('error', (error) => {
  console.error('✗ 错误:', error.message);
});
```

运行测试：

```bash
node test-skills.js
```

**预期结果**：
```
=== 测试技能系统 ===

1. 列出所有技能...
✓ 指令 1 执行成功
  找到 3 个技能:
    - 网页数据抓取 (web_scraping)
    - 文件备份 (file_backup)
    - 截图并保存 (screenshot_and_save)
2. 获取技能详情...
✓ 指令 2 执行成功
  技能: 文件备份
  步骤数: 3
```

### 6.3 测试通知系统

创建测试脚本 `test-notifications.js`：

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('=== 测试通知系统 ===\n');
  
  // 发送测试通知
  console.log('1. 发送测试通知（请查看桌面右下角）...');
  ws.send(JSON.stringify({
    type: 'command',
    id: '1',
    action: 'notification.send',
    params: {
      title: 'ClawMind 测试',
      message: '这是一条测试通知',
      type: 'info',
      sound: true
    }
  }));
  
  // 发送任务完成通知
  setTimeout(() => {
    console.log('2. 发送任务完成通知...');
    ws.send(JSON.stringify({
      type: 'command',
      id: '2',
      action: 'notification.task_complete',
      params: {
        taskName: '系统验证',
        success: true
      }
    }));
  }, 2000);
  
  setTimeout(() => ws.close(), 4000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'command_result') {
    console.log(`✓ 指令 ${msg.id} 执行成功`);
  }
});

ws.on('error', (error) => {
  console.error('✗ 错误:', error.message);
});
```

运行测试：

```bash
node test-notifications.js
```

**预期结果**：
```
=== 测试通知系统 ===

1. 发送测试通知（请查看桌面右下角）...
✓ 指令 1 执行成功
2. 发送任务完成通知...
✓ 指令 2 执行成功
```

**同时应该看到**：Windows 桌面右下角弹出两条通知

---

## 验证清单

完成以上所有测试后，检查以下清单：

### 基础设施
- [ ] help 命令正常显示
- [ ] status 命令正常显示
- [ ] doctor 诊断全部通过

### 配置管理
- [ ] 配置向导正常运行
- [ ] config.json 文件生成成功

### 核心通信
- [ ] Hermes Server 启动成功
- [ ] OpenClaw Client 启动成功
- [ ] WebSocket 连接正常
- [ ] ping/pong 测试通过

### 执行能力
- [ ] 文件读写删除正常
- [ ] 终端命令执行正常
- [ ] 剪贴板操作正常

### 界面 UI
- [ ] 桌面端启动成功（如果安装了 Rust）
- [ ] UI 组件显示正常

### 高级功能
- [ ] 对话保存和列出正常
- [ ] 用户偏好保存正常
- [ ] 技能列表和获取正常
- [ ] 桌面通知显示正常

---

## 故障排查

### 问题 1: Hermes 启动失败

**解决方案**：
```bash
# 检查 Python 依赖
pip list | findstr websockets

# 重新安装
pip install websockets
```

### 问题 2: OpenClaw 连接失败

**解决方案**：
```bash
# 检查端口占用
netstat -ano | findstr 8765

# 如果被占用，修改配置文件中的端口
```

### 问题 3: 通知不显示

**解决方案**：
```bash
# 检查 node-notifier 安装
cd C:\Users\14127\Desktop\clawmind\notifications
npm list node-notifier

# 重新安装
npm install node-notifier
```

---

## 完成验证

如果所有测试都通过，恭喜！ClawMind 系统已经完整运行。

你可以：
1. 开始实际使用场景测试
2. 集成 AI 模型（配置真实的 API Key）
3. 开发自定义技能
4. 扩展新的执行能力

**停止系统**：
```bash
# 在启动系统的终端按 Ctrl+C
```
