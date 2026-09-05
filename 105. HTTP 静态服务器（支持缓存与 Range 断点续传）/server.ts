/**
 * HTTP 静态服务器（支持缓存与 Range 断点续传）
 *
 * 特性：
 *   - 强缓存 Cache-Control / Last-Modified / ETag 协商缓存
 *   - Range 请求（206 Partial Content）支持单段
 *   - 目录访问返回索引列表
 *
 * 运行：npx ts-node server.ts [root] [port]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as crypto from 'crypto';

const root = path.resolve(process.argv[2] || '.');
const port = parseInt(process.argv[3] || '3000', 10);

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function etag(stat: fs.Stats): string {
  return `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = path.join(root, path.normalize(urlPath));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        if (stat && stat.isDirectory()) {
          fs.readdir(filePath, (e, items) => {
            if (e) {
              res.writeHead(500);
              res.end('500');
              return;
            }
            const list = items
              .map((n) => `<li><a href="${path.posix.join(urlPath, n)}">${n}</a></li>`)
              .join('\n');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!doctype html><h2>Index of ${urlPath}</h2><ul>${list}</ul>`);
          });
          return;
        }
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const tag = etag(stat);
      const lastMod = stat.mtime.toUTCString();

      // 协商缓存
      if (req.headers['if-none-match'] === tag || req.headers['if-modified-since'] === lastMod) {
        res.writeHead(304);
        res.end();
        return;
      }

      const type = mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

      // Range 请求
      const range = req.headers.range;
      if (range && typeof range === 'string') {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          let start = m[1] ? parseInt(m[1], 10) : NaN;
          let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
          if (Number.isNaN(start)) start = Math.max(0, stat.size - end - 1); // suffix
          if (Number.isNaN(end) || end >= stat.size) end = stat.size - 1;
          if (start > end || start < 0 || end >= stat.size) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'Content-Type': type,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=60',
            ETag: tag,
            'Last-Modified': lastMod,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }

      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=60',
        ETag: tag,
        'Last-Modified': lastMod,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(port, () => {
    console.log(`静态服务器已启动: http://localhost:${port}  root=${root}`);
  });
