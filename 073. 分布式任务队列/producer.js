// 任务生产者
const net = require('net');
const client = new net.Socket();

let buffer = '';
const callbacks = [];

client.connect(6700, '127.0.0.1', async () => {
  console.log('生产者连接成功');

  // 添加一批任务
  for (let i = 0; i < 5; i++) {
    const r = await send({
      op: 'add',
      queue: 'default',
      type: 'send-email',
      payload: { to: `user${i}@test.com`, subject: `通知 ${i}` },
      options: { priority: i % 3 },
    });
    console.log(`提交邮件任务: ${r.id}`);
  }

  for (let i = 0; i < 3; i++) {
    const r = await send({
      op: 'add',
      queue: 'default',
      type: 'image-resize',
      payload: { url: `pic${i}.jpg`, size: '800x600' },
    });
    console.log(`提交图片任务: ${r.id}`);
  }

  // 延迟任务
  await send({
    op: 'add',
    queue: 'default',
    type: 'data-export',
    payload: { userId: 1001, format: 'csv' },
    options: { delay: 3000 },
  });
  console.log('提交了 3 秒后执行的延迟任务');

  // 查看统计
  setInterval(async () => {
    const r = await send({ op: 'stats', queue: 'default' });
    console.log('队列状态:', r.stats);
  }, 2000);
});

client.on('data', (data) => {
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    const cb = callbacks.shift();
    if (cb) cb(JSON.parse(line));
  }
});

function send(cmd) {
  return new Promise((resolve) => {
    callbacks.push(resolve);
    client.write(JSON.stringify(cmd) + '\n');
  });
}
