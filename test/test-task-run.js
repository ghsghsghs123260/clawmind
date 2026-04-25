const WebSocket = require('ws');

const port = process.env.CLAWMIND_WEBSOCKET_PORT || 8765;
const ws = new WebSocket(`ws://localhost:${port}`);

ws.on('open', () => {
  console.log(`connected to Hermes on port ${port}`);
  ws.send(JSON.stringify({
    type: 'task.run',
    id: 'task_demo_1',
    input: '请分两步执行：先在 C:/Users/14127/ClawMind-test/test-plan.txt 写入 Hello ClawMind，然后读取这个文件内容。'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(JSON.stringify(msg, null, 2));
  if (msg.type === 'task.result' || msg.type === 'error') {
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error(error.message);
});
