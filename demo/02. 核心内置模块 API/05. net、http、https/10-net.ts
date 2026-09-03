/**
 * Demo 10 - net 模块（TCP 服务器 / 客户端 / Socket 双工流）
 * 运行：node "demo/02. 核心内置模块 API/05. net、http、https/10-net.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const net = require('node:net') as typeof import('node:net');

async function main(): Promise<void> {
  // 1. TCP 服务器：每个客户端接入触发一次回调
  const server = net.createServer((socket) => {
    console.log(`1. [服务端] 客户端接入: ${socket.remoteAddress}:${socket.remotePort}`);

    // 2. socket 是双工流：'data' 收数据，write() 发数据
    socket.on('data', (chunk) => socket.write(`echo: ${chunk}`));

    // 3. 'end'：对端半关闭（FIN），自己也 end()
    socket.on('end', () => socket.end());
    socket.on('close', () => console.log(`1. [服务端] ${socket.remotePort} 已断开`));
  });
  server.on('error', (err) => console.error('服务器错误:', err.message));

  // 4. 端口传 0：系统随机分配空闲端口
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  console.log(`1. [服务端] 监听 127.0.0.1:${port}`);

  // 5. 客户端：连接 → write 发送 → end 半关闭 → 'data' 收回显
  await new Promise<void>((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      console.log('5. [客户端] 已连接');
      socket.write('你好 TCP');
      socket.end(); // 发 FIN：不再发，但还能收
    });
    socket.on('data', (chunk) => console.log(`5. [客户端] 收到: ${chunk}`));
    socket.on('close', () => resolve());
  });

  // 6. pipe：socket 是流，可接到其它流
  await new Promise<void>((resolve) => {
    const socket = net.createConnection({ port }, () => socket.end('pipe 的一条消息'));
    socket.pipe(process.stdout);
    socket.on('close', () => {
      process.stdout.write('\n');
      resolve();
    });
  });

  // 7. 并发：3 个客户端同时连接收发
  await Promise.all(
    [1, 2, 3].map(
      (i) =>
        new Promise<void>((resolve) => {
          const socket = net.createConnection({ port }, () => socket.end(`客户端${i}`));
          socket.on('data', (chunk) => console.log(`7. 并发${i} 收到: ${chunk}`));
          socket.on('close', () => resolve());
        })
    )
  );

  // 8. close：拒绝新连接，等已有连接断开后回调
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('8. 服务器已关闭');
}

main();
