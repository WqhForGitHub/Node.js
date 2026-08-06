/**
 * DNS 查询客户端（演示）
 *
 * 用法：npx ts-node client.ts <domain> [host] [port]
 */
import * as dgram from 'dgram';

const domain = process.argv[2] || 'example.com';
const host = process.argv[3] || '127.0.0.1';
const port = parseInt(process.argv[4] || '15353', 10);

const sock = dgram.createSocket('udp4');
sock.on('message', (msg) => {
  console.log(`响应: ${msg.toString('utf8')}`);
  sock.close();
  process.exit(0);
});

sock.on('listening', () => {
  sock.send(Buffer.from(`${domain} A`), port, host);
  console.log(`查询 ${domain} A -> ${host}:${port}`);
});

setTimeout(() => {
  console.error('超时');
  process.exit(1);
}, 3000);