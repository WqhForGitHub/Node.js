// 客户端：使用一致性哈希路由到对应节点
const net = require('net');
const ConsistentHash = require('./hash');

const NODES = (process.argv[2] || '7600,7601,7602').split(',').map((p) => parseInt(p));
const ring = new ConsistentHash();
for (const p of NODES) ring.addNode(p);

function send(port, cmd) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(JSON.stringify(cmd) + '\n');
    });
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString();
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        try {
          resolve(JSON.parse(buf.slice(0, idx)));
        } catch (e) {
          reject(e);
        }
        sock.end();
      }
    });
    sock.on('error', reject);
    sock.setTimeout(3000, () => {
      sock.destroy();
      reject(new Error('timeout'));
    });
  });
}

class CacheClient {
  async get(key) {
    const node = ring.getNode(key);
    const r = await send(node, { op: 'get', key });
    return r.value;
  }
  async set(key, value, ttl) {
    const node = ring.getNode(key);
    return send(node, { op: 'set', key, value, ttl });
  }
  async del(key) {
    const node = ring.getNode(key);
    return send(node, { op: 'del', key });
  }
  async stats() {
    const all = [];
    for (const p of NODES) {
      try {
        all.push(await send(p, { op: 'stats' }));
      } catch (e) {
        all.push({ node: p, error: e.message });
      }
    }
    return all;
  }
}

// CLI 模式 / 演示模式
async function demo() {
  const client = new CacheClient();
  console.log('写入 100 个 key...');
  for (let i = 0; i < 100; i++) {
    await client.set(`key${i}`, { id: i, data: `value-${i}` }, 60000);
  }
  console.log('读取验证...');
  for (let i = 0; i < 5; i++) {
    const v = await client.get(`key${i}`);
    const node = ring.getNode(`key${i}`);
    console.log(`key${i} -> 节点 ${node}:`, v);
  }
  console.log('\n各节点统计:');
  console.log(JSON.stringify(await client.stats(), null, 2));
}

demo().catch((e) => console.error(e));
