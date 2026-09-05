// HTTPS 服务器：与 http 唯一区别是传入私钥和证书，访问 https://localhost:3443
import https from 'node:https';
import fs from 'node:fs';

const options = {
  key: fs.readFileSync('certs/server.key'),
  cert: fs.readFileSync('certs/server.crt'),
};

https
  .createServer(options, (req, res) => {
    console.log(`${req.method} ${req.url}`);
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Hello from HTTPS server!');
    } else if (req.url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ message: 'Hello!', time: new Date().toISOString() }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  })
  .listen(3443, () => console.log('HTTPS server running at https://localhost:3443'));
