/**
 * DNS 解析缓存服务器（UDP）
 *
 * 一个简化的 DNS 解析缓存服务器：
 *   - 监听 UDP 53 端口（需要管理员权限或改端口）
 *   - 客户端发送明文查询请求： "example.com A"
 *   - 命中缓存直接返回；否则调用 dns 模块解析，缓存 + 返回
 *   - 缓存条目默认 TTL 60s
 *
 * 运行：npx ts-node server.ts [port]
 *   client.ts 可作示例客户端： npx ts-node client.ts example.com 127.0.0.1
 */
import * as dgram from 'dgram';
import * as dns from 'dns';
import * as cache from './cache';

const port = parseInt(process.argv[2] || '15353', 10); // 默认 15353 避免权限问题
const TTL_MS = 60_000;
const dnsCache = new cache.LRUCache<string, { ips: string[]; exp: number }>(1000);

interface Query {
  name: string;
  type: string;
}

async function resolve(q: Query): Promise<string[]> {
  const key = `${q.name}|${q.type}`;
  const cached = dnsCache.get(key);
  if (cached && cached.exp > Date.now()) {
    console.log(`[cache 命中] ${key}`);
    return cached.ips;
  }
  console.log(`[upstream] 解析 ${key}`);
  return new Promise<string[]>((resolve, reject) => {
    dns.resolve4(q.name, (err, addresses) => {
      if (err) return reject(err);
      dnsCache.put(key, { ips: addresses, exp: Date.now() + TTL_MS });
      resolve(addresses);
    });
  });
}

const sock = dgram.createSocket('udp4');

sock.on('message', async (msg, rinfo) => {
  const text = msg.toString('utf8').trim();
  let q: Query;
  try {
    q = text.startsWith('{') ? JSON.parse(text) : parseLine(text);
  } catch {
    sock.send(Buffer.from('error: 无法解析查询'), rinfo.port, rinfo.address);
    return;
  }
  try {
    const ips = await resolve(q);
    const resp = JSON.stringify({ name: q.name, ips, cache: 'maybe' });
    sock.send(Buffer.from(resp), rinfo.port, rinfo.address);
  } catch (e: any) {
    sock.send(Buffer.from(`error: ${e.message}`), rinfo.port, rinfo.address);
  }
});

function parseLine(text: string): { name: string; type: string } {
  const parts = text.split(/\s+/);
  return { name: parts[0], type: parts[1] || 'A' };
}

sock.on('listening', () => {
  const a = sock.address();
  console.log(`DNS 缓存服务器已启动 ${a.address}:${a.port}`);
});

sock.bind(port);