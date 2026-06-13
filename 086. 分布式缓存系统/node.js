// 缓存节点：TCP 服务器 + 节点间 gossip
const net = require('net');
const LRUCache = require('./lru');

const port = parseInt(process.argv[2] || '7600');
const peers = (process.argv[3] || '').split(',').filter(Boolean).map(p => parseInt(p));

const cache = new LRUCache(10000);
const nodeId = `node-${port}`;

console.log(`启动节点 ${nodeId}, peers: ${peers.join(',') || '(无)'}`);

// ========== 服务端 ==========
const server = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const cmd = JSON.parse(line);
        const resp = handle(cmd);
        socket.write(JSON.stringify(resp) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
      }
    }
  });
  socket.on('error', () => {});
});

function handle(cmd) {
  switch (cmd.op) {
    case 'get': {
      const v = cache.get(cmd.key);
      return { ok: true, value: v === undefined ? null : v, hit: v !== undefined };
    }
    case 'set': {
      cache.set(cmd.key, cmd.value, cmd.ttl);
      // 复制到 peer（如果指定）
      if (cmd.replicate && peers.length) {
        for (const p of peers) replicate(p, cmd.key, cmd.value, cmd.ttl);
      }
      return { ok: true };
    }
    case 'del': {
      cache.del(cmd.key);
      return { ok: true };
    }
    case 'stats': {
      return { ok: true, node: nodeId, size: cache.size(), stats: cache.stats };
    }
    case 'ping': return { ok: true, node: nodeId };
    default: return { ok: false, error: 'unknown op' };
  }
}

function replicate(peerPort, key, value, ttl) {
  const sock = net.connect(peerPort, '127.0.0.1', () => {
    sock.write(JSON.stringify({ op: 'set', key, value, ttl }) + '\n');
  });
  sock.on('data', () => sock.end());
  sock.on('error', () => {});
}

server.listen(port, () => console.log(`节点监听 tcp://127.0.0.1:${port}`));

// 周期性向 peer ping，检测可达性
setInterval(() => {
  for (const p of peers) {
    const sock = net.connect(p, '127.0.0.1', () => {
      sock.write(JSON.stringify({ op: 'ping' }) + '\n');
    });
    sock.setTimeout(2000);
    sock.on('data', () => sock.end());
    sock.on('error', () => {});
    sock.on('timeout', () => sock.destroy());
  }
}, 5000);

process.on('SIGINT', () => { server.close(); process.exit(0); });
