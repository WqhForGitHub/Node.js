/**
 * 002 - 如何在 Node.js 中创建一个简单的 HTTP 服务器？
 *
 * 核心 API：http.createServer([options][, requestListener])
 * - requestListener: (req: IncomingMessage, res: ServerResponse) => void
 * - server.listen(port, callback) 开始监听端口
 * - res.writeHead(statusCode, headers) 写入状态码和响应头
 * - res.end(data) 结束响应（并发送数据）
 */

import { createServer, get, type IncomingMessage, type Server } from 'node:http';

const PORT = 3000;

// ============================================================
// 1. 创建服务器：根据 URL 做简单路由
// ============================================================
const server: Server = createServer((req: IncomingMessage, res) => {
  const url: string = req.url ?? '/';

  // 路由：返回 JSON
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        message: '你好，HTTP 服务器！',
        method: req.method,
        url,
      })
    );
    return;
  }

  // 路由：返回 HTML
  if (url === '/html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Hello Node.js</h1>');
    return;
  }

  // 其他路径：404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

// ============================================================
// 2. 监听端口，启动后自动请求 3 个路由演示并关闭
// ============================================================
server.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}\n`);
  requestAndLog('/');
  requestAndLog('/html');
  requestAndLog('/not-exist');
});

// 记录剩余请求数，全部完成后关闭服务器
let pending: number = 3;

function requestAndLog(path: string): void {
  get({ host: 'localhost', port: PORT, path }, (res: IncomingMessage) => {
    let body: string = '';
    res.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    res.on('end', () => {
      console.log(`GET ${path} -> [${res.statusCode}] ${body}`);
      if (--pending === 0) {
        server.close(() => console.log('\n演示完成，服务器已关闭'));
      }
    });
  });
}
