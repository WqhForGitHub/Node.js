// 最简 HTTP 服务器：node index.ts，访问 http://localhost:3000
import http from 'node:http';

http
  .createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Hello from HTTP server!');
    } else if (req.url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ message: 'Hello!', time: new Date().toISOString() }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  })
  .listen(3000, () => console.log('HTTP server running at http://localhost:3000'));
