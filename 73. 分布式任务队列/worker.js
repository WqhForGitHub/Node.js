// 工作进程 - 处理任务
const net = require('net');

const HOST = '127.0.0.1';
const PORT = 6700;
const WORKER_ID = `worker-${process.pid}`;

const handlers = {
  'send-email': async (payload) => {
    console.log(`  [邮件] 发送至 ${payload.to}: ${payload.subject}`);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    return { sent: true, time: Date.now() };
  },
  'image-resize': async (payload) => {
    console.log(`  [图片] 缩放 ${payload.url} -> ${payload.size}`);
    await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    if (Math.random() < 0.2) throw new Error('网络错误');
    return { resized: true, output: `cdn/${payload.url}-${payload.size}.jpg` };
  },
  'data-export': async (payload) => {
    console.log(`  [导出] 用户 ${payload.userId} ${payload.format} 文件`);
    await new Promise(r => setTimeout(r, 1000));
    return { downloadUrl: `/exports/${payload.userId}.${payload.format}` };
  }
};

const client = new net.Socket();
let buffer = '';
const callbacks = [];

client.connect(PORT, HOST, () => {
  console.log(`[${WORKER_ID}] 已连接到队列服务器`);
  poll();
});

client.on('data', (data) => {
  buffer += data.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    const cb = callbacks.shift();
    if (cb && line.trim()) {
      try { cb(JSON.parse(line)); } catch (e) { cb({ ok: false, error: e.message }); }
    }
  }
});

client.on('error', (err) => {
  console.error(`[${WORKER_ID}] 连接错误:`, err.message);
  process.exit(1);
});

function send(cmd) {
  return new Promise((resolve) => {
    callbacks.push(resolve);
    client.write(JSON.stringify(cmd) + '\n');
  });
}

async function poll() {
  while (true) {
    const res = await send({ op: 'reserve', queue: 'default', workerId: WORKER_ID });
    if (!res.ok || !res.task) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    const task = res.task;
    console.log(`[${WORKER_ID}] 处理任务 ${task.id} (${task.type}) 第 ${task.attempts} 次`);
    const handler = handlers[task.type];
    if (!handler) {
      await send({ op: 'fail', queue: 'default', id: task.id, error: 'No handler' });
      continue;
    }
    try {
      const result = await handler(task.payload);
      await send({ op: 'complete', queue: 'default', id: task.id, result });
      console.log(`[${WORKER_ID}] 完成 ${task.id}`);
    } catch (e) {
      await send({ op: 'fail', queue: 'default', id: task.id, error: e.message });
      console.log(`[${WORKER_ID}] 失败 ${task.id}: ${e.message}`);
    }
  }
}
