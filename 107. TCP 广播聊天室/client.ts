/**
 * TCP 聊天室客户端（可选，也可以用 telnet/nc）
 *
 * 运行：npx ts-node client.ts 5000
 */
import * as net from 'net';

const port = parseInt(process.argv[2] || '5000', 10);
const sock = net.connect(port, '127.0.0.1');

sock.on('connect', () => {
  process.stdout.write('已连接，输入消息回车发送：\n');
});

sock.on('data', (d) => {
  process.stdout.write(d.toString('utf8'));
});

sock.on('close', () => {
  process.stdout.write('连接已关闭\n');
  process.exit(0);
});

sock.on('error', (e) => {
  console.error('连接错误', e);
  process.exit(1);
});

process.stdin.setEncoding('utf8');
process.stdin.on('data', (line) => {
  sock.write(line);
});