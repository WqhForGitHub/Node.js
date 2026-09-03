/**
 * Demo 11 - http 模块（服务器：req/res；客户端：get/request）
 * 运行：node "demo/02. 核心内置模块 API/05. net、http、https/11-http.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('node:http') as typeof import('node:http');

async function main(): Promise<void> {
  // ================ 服务器 ================

  // 1. createServer：每个请求触发一次回调
  //    req（IncomingMessage）：可读流；res（ServerResponse）：可写流
  const server = http.createServer((req, res) => {
    console.log(`1. 收到请求: ${req.method} ${req.url}`);
    const url = new URL(req.url ?? '/', 'http://localhost'); // 解析路径 + 查询参数

    if (req.method === 'GET' && url.pathname === '/') {
      // 2. writeHead：状态码+响应头；end：写响应体并结束
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('主页');
    } else if (req.method === 'GET' && url.pathname === '/hello') {
      // 3. 查询参数：/hello?name=Tom
      const name = url.searchParams.get('name') ?? '游客';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ hello: name }));
    } else if (req.method === 'POST' && url.pathname === '/echo') {
      // 4. 请求体：'data' 逐块收集，'end' 完毕
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`收到: ${body}`);
      });
    } else if (req.method === 'GET' && url.pathname === '/stream') {
      // 5. 流式响应：res.write 分块推送，最后必须 end
      res.statusCode = 200; // 等价于 writeHead
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      let i = 1;
      const timer = setInterval(() => {
        res.write(`第${i}块\n`);
        if (i++ === 3) {
          clearInterval(timer);
          res.end();
        }
      }, 100);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  });
  server.on('error', (err) => console.error('服务器错误:', err.message));

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  console.log(`1. 服务器监听: http://127.0.0.1:${port}`);

  // ================ 客户端 ================

  // 6. http.get：res 含 statusCode / headers，且是可读流
  await new Promise<void>((resolve) => {
    http.get(`http://127.0.0.1:${port}/hello?name=Node`, (res) => {
      console.log('6. 状态码:', res.statusCode, '| 类型:', res.headers['content-type']);
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('6. 响应体:', data);
        resolve();
      });
    });
  });

  // 7. http.request：任意方法（此处 POST）；请求也是流：write + end
  await new Promise<void>((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/echo',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log('7. POST 回显:', data);
          resolve();
        });
      }
    );
    req.end('这是请求体'); // 不 end 请求发不出去
  });

  // 8. for await：响应流可异步迭代，逐块处理
  const res = await new Promise<import('node:http').IncomingMessage>((resolve, reject) =>
    http.get(`http://127.0.0.1:${port}/stream`, resolve).on('error', reject)
  );
  for await (const chunk of res) console.log('8. 块:', chunk.toString().trim());

  // 9. close：处理完已有请求后关闭
  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log('9. 服务器已关闭');
}

main();
