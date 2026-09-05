// 日志推送客户端：监控本地文件并推送到平台
const fs = require('fs');
const net = require('net');
const path = require('path');

const TCP_PORT = 7301;
const file = process.argv[2];

if (!file) {
  // 没有指定文件就生成模拟日志
  const sock = net.connect(TCP_PORT, '127.0.0.1', () => {
    console.log('已连接，开始发送模拟日志');
    const levels = ['INFO', 'WARN', 'ERROR'];
    const msgs = ['user login', 'db query slow', 'cache miss', 'request failed', 'config reloaded'];
    setInterval(() => {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      const line = `[${level}] ${new Date().toISOString()} ${msg}\n`;
      sock.write(line);
      process.stdout.write(line);
    }, 500);
  });
  sock.on('error', (e) => console.error('连接错误:', e.message));
  return;
}

// tail -f 模式
const sock = net.connect(TCP_PORT, '127.0.0.1', () => {
  console.log(`监控 ${file}`);
  let position = fs.statSync(file).size;
  fs.watch(file, () => {
    const stat = fs.statSync(file);
    if (stat.size < position) position = 0;
    if (stat.size > position) {
      const stream = fs.createReadStream(file, { start: position, end: stat.size });
      stream.on('data', (chunk) => sock.write(chunk));
      position = stat.size;
    }
  });
});
sock.on('error', (e) => console.error('连接错误:', e.message));
