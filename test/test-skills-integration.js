/**
 * 测试 Skills 集成
 * 完整的端到端测试
 */

const WebSocket = require('ws');

console.log('Testing Skills Integration...\n');

// 连接到 Hermes
const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('✓ Connected to Hermes\n');

  // 测试 1: 发送一个应该匹配 Skill 的任务
  console.log('Test 1: Task that should match a skill');
  console.log('Input: "take a screenshot"\n');

  ws.send(JSON.stringify({
    type: 'task.run',
    id: 'test_skill_1',
    input: 'take a screenshot',
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('Received message:');
    console.log(JSON.stringify(message, null, 2));
    console.log('');

    if (message.type === 'task.result') {
      console.log('✓ Task completed');

      // 等待一下再发送下一个测试
      setTimeout(() => {
        console.log('Test 2: Task that should use LLM planning');
        console.log('Input: "create a new file called test.txt"\n');

        ws.send(JSON.stringify({
          type: 'task.run',
          id: 'test_skill_2',
          input: 'create a new file called test.txt',
        }));
      }, 2000);
    }
  } catch (error) {
    console.error('Error parsing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('Connection closed');
});

// 超时退出
setTimeout(() => {
  console.log('\nTest timeout, closing connection');
  ws.close();
  process.exit(0);
}, 30000);
