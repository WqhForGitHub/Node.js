// 模拟设备生成数据
const dgram = require('dgram');

const UDP_PORT = 7201;
const client = dgram.createSocket('udp4');

const devices = ['dev-001', 'dev-002', 'dev-003'];
const metrics = ['temperature', 'humidity', 'pressure'];

setInterval(() => {
  const point = {
    device: devices[Math.floor(Math.random() * devices.length)],
    metric: metrics[Math.floor(Math.random() * metrics.length)],
    value: Math.random() * 100,
    ts: Date.now(),
  };
  const buf = Buffer.from(JSON.stringify(point));
  client.send(buf, UDP_PORT, '127.0.0.1');
  console.log('发送:', point);
}, 1000);

process.on('SIGINT', () => {
  client.close();
  process.exit(0);
});
