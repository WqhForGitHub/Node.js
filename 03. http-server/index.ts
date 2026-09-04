import http from 'http';
import fs from 'fs';
import path from 'path';

// req/res 类型由 createServer 自动推断：
// req: http.IncomingMessage, res: http.ServerResponse
const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, '.', req.url ?? '/');

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
