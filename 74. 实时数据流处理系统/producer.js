// 数据生产者 - 模拟实时事件流
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const types = ['click', 'view', 'purchase', 'login', 'logout', 'error', 'search'];
const types_weights = [30, 40, 5, 8, 6, 2, 9];

function pickType() {
  const total = types_weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < types.length; i++) {
    r -= types_weights[i];
    if (r <= 0) return types[i];
  }
  return types[0];
}

let count = 0;
setInterval(() => {
  const event = {
    type: pickType(),
    userId: Math.floor(Math.random() * 1000),
    page: `/page-${Math.floor(Math.random() * 50)}`,
    ts: Date.now()
  };
  const msg = Buffer.from(JSON.stringify(event));
  client.send(msg, 7401, '127.0.0.1');
  count++;
  if (count % 100 === 0) console.log(`已发送 ${count} 条事件`);
}, 30); // ~33 events/s

console.log('开始发送事件流到 UDP 7401...');
