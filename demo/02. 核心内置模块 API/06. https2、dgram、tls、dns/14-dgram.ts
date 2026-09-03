/**
 * Demo 14 - dgram 模块（UDP 数据报：无连接、不保证送达；适合 DNS、心跳、日志上报）
 * 运行：node "demo/02. 核心内置模块 API/06. https2、dgram、tls、dns/14-dgram.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dgram = require('node:dgram') as typeof import('node:dgram');

async function main(): Promise<void> {
  // ===== 服务器（接收方）=====

  // 1. createSocket('udp4')：IPv4 的 UDP 套接字（IPv6 用 'udp6'）
  const server = dgram.createSocket('udp4');

  // 2. message：每收到一包触发一次，rinfo 是来源地址
  server.on('message', (msg, rinfo) => {
    console.log(`2. 服务器收到: "${msg}"（来自 ${rinfo.address}:${rinfo.port}）`);
    server.send(`echo: ${msg}`, rinfo.port, rinfo.address); // 回包也要写地址（无连接）
  });
  server.on('error', (err) => console.error('服务器错误:', err.message));

  // 3. bind：绑定端口才能收包（0 = 系统随机分配）
  await new Promise<void>((resolve) => server.bind(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  console.log(`3. 服务器监听: udp://127.0.0.1:${port}`);

  // ===== 客户端（发送方）=====

  // 4. 客户端套接字：不 bind 也能收发（首次 send 自动分配临时端口）
  const client = dgram.createSocket('udp4');
  client.on('message', (msg) => console.log(`4. 客户端收到: "${msg}"`));

  // 5. send：发一包（数据+端口+地址），回调表示已交内核
  await new Promise<void>((resolve) => {
    client.once('message', () => resolve()); // 等服务器回包
    client.send('hello udp', port, '127.0.0.1', () => console.log('5. 客户端已发送'));
  });

  // 6. connect：预设默认目标，send 省地址（仍是 UDP，并非建连）
  const probe = dgram.createSocket('udp4');
  await new Promise<void>((resolve) => probe.connect(port, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => {
    probe.once('message', () => resolve());
    probe.send('connected send'); // 省略地址端口
  });

  // 7. close：直接关闭（UDP 没有挥手确认）
  client.close();
  probe.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('7. 已关闭');
}

main();
