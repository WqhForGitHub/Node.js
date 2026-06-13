// 队列服务器 - 通过 TCP 协议暴露任务队列
const net = require('net');
const TaskQueue = require('./queue');

const PORT = 6700;
const queues = new Map();

function getQueue(name) {
  if (!queues.has(name)) queues.set(name, new TaskQueue(name));
  return queues.get(name);
}

// 简单的换行分隔 JSON 协议
function handleCommand(cmd) {
  const { op, queue: qname } = cmd;
  const queue = getQueue(qname || 'default');

  switch (op) {
    case 'add': {
      const id = queue.add(cmd.type, cmd.payload, cmd.options || {});
      return { ok: true, id };
    }
    case 'reserve': {
      const task = queue.reserve(cmd.workerId);
      return { ok: true, task };
    }
    case 'complete': {
      queue.complete(cmd.id, cmd.result);
      return { ok: true };
    }
    case 'fail': {
      queue.fail(cmd.id, cmd.error);
      return { ok: true };
    }
    case 'stats': {
      return { ok: true, stats: queue.stats() };
    }
    default:
      return { ok: false, error: 'Unknown op' };
  }
}

const server = net.createServer((socket) => {
  console.log('客户端连接:', socket.remoteAddress, socket.remotePort);
  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const cmd = JSON.parse(line);
        const response = handleCommand(cmd);
        socket.write(JSON.stringify(response) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
      }
    }
  });

  socket.on('error', (err) => console.error('Socket 错误:', err.message));
  socket.on('close', () => console.log('客户端断开'));
});

server.listen(PORT, () => {
  console.log(`分布式任务队列服务器启动: tcp://127.0.0.1:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\n关闭服务器...');
  for (const q of queues.values()) q.shutdown();
  server.close(() => process.exit(0));
});
