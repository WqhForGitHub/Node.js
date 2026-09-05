/**
 * 大文件分片复制与 MD5 校验
 *
 * 思路：将源文件按固定 chunk 大小分片读取，逐片写入目标文件，
 * 同时把每片喂给 MD5 Hash 流，复制结束即得到全文件 MD5。
 * 再对目标文件做一次 MD5 校验，比对两者是否一致。
 *
 * 运行：npx ts-node copy.ts <src> <dst> [chunkSize]
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

async function copyWithMd5(
  src: string,
  dst: string,
  chunkSize = 1024 * 1024
): Promise<{ srcMd5: string; dstMd5: string; ok: boolean }> {
  const stat = fs.statSync(src);
  if (!stat.isFile()) throw new Error(`${src} 不是文件`);

  const srcFd = fs.openSync(src, 'r');
  const dstFd = fs.openSync(dst, 'w');
  const srcHash = crypto.createHash('md5');
  const dstHash = crypto.createHash('md5');

  const total = stat.size;
  let offset = 0;
  const buf = Buffer.alloc(chunkSize);

  while (offset < total) {
    const len = Math.min(chunkSize, total - offset);
    const n = fs.readSync(srcFd, buf, 0, len, offset);
    if (n <= 0) break;
    const chunk = buf.slice(0, n);
    fs.writeSync(dstFd, chunk, 0, n, offset);
    srcHash.update(chunk);
    offset += n;
    if ((offset >>> 20) % 64 === 0) {
      process.stdout.write(`\r已复制 ${((offset / total) * 100).toFixed(2)}%`);
    }
  }
  process.stdout.write(`\r已复制 100.00%\n`);
  fs.closeSync(srcFd);
  fs.closeSync(dstFd);

  // 校验目标文件
  await new Promise<void>((resolve, reject) => {
    const r = fs.createReadStream(dst);
    r.on('data', (d) => dstHash.update(d));
    r.on('end', () => resolve());
    r.on('error', reject);
  });

  const srcMd5 = srcHash.digest('hex');
  const dstMd5 = dstHash.digest('hex');
  return { srcMd5, dstMd5, ok: srcMd5 === dstMd5 };
}

async function main() {
  const [, , srcArg, dstArg, chunkArg] = process.argv;
  if (!srcArg || !dstArg) {
    console.log('用法: ts-node copy.ts <src> <dst> [chunkSizeBytes]');
    process.exit(1);
  }
  const src = path.resolve(srcArg);
  const dst = path.resolve(dstArg);
  const chunk = chunkArg ? parseInt(chunkArg, 10) : 1024 * 1024;
  const t0 = Date.now();
  const r = await copyWithMd5(src, dst, chunk);
  console.log(`源 MD5: ${r.srcMd5}`);
  console.log(`目标 MD5: ${r.dstMd5}`);
  console.log(`校验结果: ${r.ok ? '通过' : '失败'}`);
  console.log(`耗时: ${Date.now() - t0} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
