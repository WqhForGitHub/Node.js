/**
 * Demo 13 - http2 模块（HTTP/2：单连接多路复用，请求/响应都是流 stream）
 * 运行：node "demo/02. 核心内置模块 API/06. https2、dgram、tls、dns/13-http2.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const http2 = require('node:http2') as typeof import('node:http2');

async function main(): Promise<void> {
  // ===== 服务器（明文 h2c，加密版见 Demo 12）=====

  // 1. createServer：每个请求一个 stream（双工流），路径在伪头部 :path
  const server = http2.createServer((req, res) => {
    const path = req.headers[':path'] as string;
    console.log(`1. 收到流: ${req.headers[':method']} ${path}`);

    if (path === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Hello HTTP/2');
    } else if (path === '/stream') {
      // 2. res 是流：write 分块推送，最后 end
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      let i = 1;
      const timer = setInterval(() => {
        res.write(`第${i}块\n`);
        if (i++ === 3) {
          clearInterval(timer);
          res.end();
        }
      }, 100);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  server.on('error', (err) => console.error('服务器错误:', err.message));

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  console.log(`1. 服务器监听: http://127.0.0.1:${port}`);

  // ===== 客户端 =====

  // 3. connect：建立会话 session（一条连接），后续请求全部复用
  const session = http2.connect(`http://127.0.0.1:${port}`);
  session.on('error', (err) => console.error('会话错误:', err.message));

  // 小工具：GET 并等待完整响应
  const get = (path: string): Promise<{ status: number | undefined; body: string }> =>
    new Promise((resolve, reject) => {
      const stream = session.request({ ':method': 'GET', ':path': path });
      stream.setEncoding('utf8');
      let body = '';
      // 4. response 事件：响应头到达，状态码在 :status
      stream.on('response', (headers) => {
        stream.on('data', (chunk: string) => (body += chunk));
        stream.on('end', () => resolve({ status: headers[':status'], body }));
      });
      stream.on('error', reject);
      stream.end(); // 没有请求体也要 end
    });

  const r = await get('/');
  console.log(`4. 响应: ${r.status} ${r.body}`);

  // 5. 多路复用：3 个请求在同一 session 并发
  const start = Date.now();
  const results = await Promise.all([get('/stream'), get('/stream'), get('/nope')]);
  console.log(
    `5. 并发完成 [${results.map((x) => x.status)}] 耗时 ${Date.now() - start}ms` +
      `（HTTP/1.1 单连接需排队，约 3 倍时间）`
  );

  // 6. for await：响应流可异步迭代
  const stream = session.request({ ':path': '/stream' });
  stream.setEncoding('utf8');
  for await (const chunk of stream) console.log('6. 块:', chunk.trim());

  // 7. 关闭会话与服务器
  await new Promise<void>((resolve) => session.close(() => resolve()));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('7. 已关闭');
}

main();
