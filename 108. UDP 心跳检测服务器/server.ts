/**
 * UDP 心跳检测服务器
 *
 * 通过 UDP 数据报实现简易心跳协议：
 *  - 客户端每隔 N 秒发送 "PING <id>"。
 *  - 服务端收到响应 "PONG <id>"，并记录每个客户端最后心跳时间。
 *  - 服务端定时扫描，超过阈值未收到心跳则视为离线，从列表移除。
 *
 * 运行：
 *   服务端：npx ts-node server.ts 41234
 *   客户端：npx ts-node client.ts 41234 5
 */
import * as dgram from 'dgram';

interface Peer {
  addr: string;
  port: number;
  lastBeat: number;
}

const peers = new Map<string, Peer>();
const TIMEOUT_MS = 15_000;
const CHECK_INTERVAL = 5_000;

function key(addr: string, port: number) {
  return `${addr}:${port}`;
}

const sock = dgram.createSocket('udp4');

sock.on('message', (msg, rinfo) => {
  const text = msg.toString('utf8').trim();
  const k = key(rinfo.address, rinfo.port);
  if (text.startsWith('PING')) {
    peers.set(k, { addr: rinfo.address, port: rinfo.port, lastBeat: Date.now() });
    sock.send(`PONG ${text.slice(5).trim()}`, rinfo.port, rinfo.address);
    console.log(`[+] ${k} 心跳，当前在线 ${peers.size}`);
  } else if (text === 'WHO') {
    const list = [...peers.values()].map((p) => key(p.addr, p.port)).join(',');
    sock.send(`ONLINE ${list}`, rinfo.port, rinfo.address);
  }
});

sock.on('listening', () => {
  const a = sock.address();
  console.log(`UDP 心跳服务已启动 ${a.address}:${a.port}`);
});

setInterval(() => {
  const now = Date.now();
  for (const [k, p] of peers) {
    if (now - p.lastBeat > TIMEOUT_MS) {
      peers.delete(k);
      console.log(`[-] ${k} 已离线（超时）`);
    }
  }
  console.log(`当前在线客户端: ${peers.size}`);
}, CHECK_INTERVAL);

const port = parseInt(process.argv[2] || '41234', 10);
sock.bind(port);
