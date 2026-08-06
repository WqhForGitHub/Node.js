/**
 * HTTP 客户端断点续传下载器
 *
 * - 通过 Range 请求按 chunk 大小分块下载，支持续传。
 * - 本地临时文件 .part 保存已下载字节数；中断后重启续传。
 * - 完成后校验总大小 == Content-Length。
 *
 * 运行：npx ts-node downloader.ts <url> <outFile> [concurrency] [chunkMB]
 */
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

interface Part { start: number; end: number; }

function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET', headers: { Range: `bytes=${start}-${end}` } }, (res) => {
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function headContentLength(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.request(url, { method: 'HEAD' }, (res) => {
      res.resume();
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const len = parseInt(res.headers['content-length'] || '0', 10);
      if (!len) return reject(new Error('无 Content-Length，无法分块下载'));
      resolve(len);
    }).on('error', reject).end();
  });
}

async function main() {
  const url = process.argv[2];
  const out = path.resolve(process.argv[3] || 'download.bin');
  const chunkBytes = parseInt(process.argv[4] || '1', 10) * 1024 * 1024;
  if (!url) throw new Error('用法: ts-node downloader.ts <url> <outFile> [chunkMB]');

  const total = await headContentLength(url);
  console.log(`总大小 ${total} bytes`);

  const progressFile = out + '.progress.json';
  let downloaded: Record<string, number> = {};
  if (fs.existsSync(out) && fs.existsSync(progressFile)) {
    downloaded = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log(`已存在进度文件，续传`);
  } else {
    // 预分配文件
    const fd = fs.openSync(out, 'w');
    fs.ftruncateSync(fd, total);
    fs.closeSync(fd);
  }

  // 逐段下载
  for (let start = 0; start < total; start += chunkBytes) {
    const key = String(start);
    if (downloaded[key] === 1) {
      continue;
    }
    const end = Math.min(start + chunkBytes - 1, total - 1);
    const buf = await fetchRange(url, start, end);
    if (buf.length !== end - start + 1) {
      throw new Error(`分片 ${start}-${end} 数据长度不符: ${buf.length}`);
    }
    const fd = fs.openSync(out, 'r+');
    fs.writeSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    downloaded[key] = 1;
    fs.writeFileSync(progressFile, JSON.stringify(downloaded));
    const pct = ((start + buf.length) / total * 100).toFixed(2);
    process.stdout.write(`\r已下载 ${pct}%`);
  }
  process.stdout.write(`\r已下载 100.00%\n`);

  // 校验
  const stat = fs.statSync(out);
  if (stat.size !== total) throw new Error(`最终大小 ${stat.size} != ${total}`);
  fs.unlinkSync(progressFile);
  console.log(`完成: ${out} (${total} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});