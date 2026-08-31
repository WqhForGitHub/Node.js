// 模拟 IoT 设备客户端
const net = require('net');

const TCP_PORT = 7101;
const deviceId = process.argv[2] || `dev-${Math.random().toString(36).slice(2, 8)}`;
const deviceType = process.argv[3] || 'temperature-sensor';

const socket = net.connect(TCP_PORT, '127.0.0.1', () => {
  console.log(`设备 ${deviceId} 连接到平台`);
  send({ type: 'register', id: deviceId, info: { type: deviceType, group: 'demo' } });
});

function send(obj) {
  socket.write(JSON.stringify(obj) + '\n');
}

let buffer = '';
socket.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.type === 'command') {
      console.log(`[${deviceId}] 收到命令:`, msg.cmd);
    } else if (msg.type === 'registered') {
      console.log(`[${deviceId}] 注册成功`);
    }
  }
});

socket.on('error', (e) => console.error('连接错误:', e.message));
socket.on('close', () => {
  console.log('断开');
  process.exit(0);
});

// 心跳
setInterval(() => send({ type: 'heartbeat', id: deviceId }), 10000);

// 模拟遥测数据
setInterval(() => {
  send({
    type: 'telemetry',
    id: deviceId,
    data: {
      temperature: (20 + Math.random() * 10).toFixed(2),
      humidity: (40 + Math.random() * 20).toFixed(2),
    },
  });
}, 5000);

process.on('SIGINT', () => {
  socket.end();
});
