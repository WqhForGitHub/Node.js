/**
 * UDP 心跳客户端
 *
 * 运行：npx ts-node client.ts 41234 [间隔秒数]
 */
import * as dgram from 'dgram';

const port = parseInt(process.argv[2] || '41234', 10);
const interval = parseInt(process.argv[3] || '5', 10) * 1000;
const id = Math.floor(Math.random() * 1e6).toString();

const sock = dgram.createSocket('udp4');

sock.on('message', (msg) => {
  console.log(`收到: ${msg.toString('utf8')}`);
});

function ping() {
  const pkt = Buffer.from(`PING ${id}`, 'utf8');
  sock.send(pkt, port, '127.0.0.1');
  console.log(`-> PING ${id}`);
}

setInterval(ping, interval);
ping();

process.on('SIGINT', () => {
  sock.close();
  console.log('\n退出');
  process.exit(0);
});
