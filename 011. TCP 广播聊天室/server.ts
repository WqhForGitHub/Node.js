/**
 * TCP 广播聊天室
 *
 * 服务端监听一个 TCP 端口，每个连接的客户端收到的消息会广播给除自己外的所有客户端。
 * 支持昵称设置（/nick <name>）、列出在线（/who）、退出（/quit）。
 *
 * 运行：
 *   服务端：npx ts-node server.ts 5000
 *   客户端：telnet localhost 5000  或  npx ts-node client.ts 5000
 */
import * as net from 'net';

interface Client {
  sock: net.Socket;
  name: string;
}

const clients = new Set<Client>();

function broadcast(from: Client, msg: string) {
  const line = `[${from.name}] ${msg}\n`;
  for (const c of clients) {
    if (c === from) continue;
    c.sock.write(line);
  }
}

function sendWelcome(c: Client) {
  c.sock.write(`欢迎加入聊天室，当前在线 ${clients.size} 人。\n`);
  c.sock.write(`命令: /nick <name> 设置昵称 | /who 查看在线 | /quit 退出\n`);
}

const server = net.createServer((sock) => {
  const client: Client = { sock, name: `user${sock.remotePort}` };
  clients.add(client);
  console.log(`[+] ${client.name} 加入`);
  sendWelcome(client);
  broadcast(client, `加入了聊天室`);

  sock.setEncoding('utf8');
  let buf = '';
  sock.on('data', (chunk) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      handleLine(client, line);
    }
  });

  sock.on('close', () => {
    clients.delete(client);
    console.log(`[-] ${client.name} 离开`);
    broadcast(client, `离开了聊天室`);
  });
  sock.on('error', () => {
    clients.delete(client);
  });
});

function handleLine(c: Client, line: string) {
  const text = line.trim();
  if (!text) return;
  if (text.startsWith('/nick ')) {
    const name = text.slice(6).trim();
    if (name) {
      const old = c.name;
      c.name = name;
      c.sock.write(`昵称已改为 ${name}\n`);
      broadcast(c, `${old} 改名为 ${name}`);
    }
    return;
  }
  if (text === '/who') {
    const list = [...clients].map((x) => x.name).join(', ');
    c.sock.write(`在线: ${list}\n`);
    return;
  }
  if (text === '/quit') {
    c.sock.end('再见\n');
    return;
  }
  broadcast(c, text);
  c.sock.write(`(我) ${text}\n`);
}

const port = parseInt(process.argv[2] || '5000', 10);
server.listen(port, () => {
  console.log(`TCP 聊天室已启动 :${port}`);
});
