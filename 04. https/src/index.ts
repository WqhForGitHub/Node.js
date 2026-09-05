// HTTPS 服务器：node src/index.ts 启动，浏览器访问 https://localhost:3443（自签名证书会有安全提示，属正常现象）
import https from 'node:https';
import fs from 'node:fs';

const port = 3443;

// 与 http-demo 的唯一区别：需要提供私钥和证书
const options = {
  key: fs.readFileSync('certs/server.key'),
  cert: fs.readFileSync('certs/server.crt'),
};

const server = https.createServer(options, (req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Hello from HTTPS server!');
  } else if (req.url === '/json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Hello from HTTPS server!', time: new Date().toISOString() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(port, () => {
  console.log(`HTTPS server running at https://localhost:${port}`);
});
