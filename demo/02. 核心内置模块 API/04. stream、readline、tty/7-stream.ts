/**
 * Demo 7 - stream 流（Readable / Writable / Duplex / Transform）
 * 运行：node "demo/02. 核心内置模块 API/04. stream、readline、tty/7-stream.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeStream = require('node:stream') as typeof import('node:stream');
const { Readable, Writable, Duplex, Transform } = nodeStream;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pipeline } = require('node:stream/promises') as typeof import('node:stream/promises');

const TMP = path.join(__dirname, 'tmp');

async function main(): Promise<void> {
  // 1. Readable：'data' 逐块触发，'end' 结束
  await new Promise<void>((resolve) => {
    const r = Readable.from(['春', '夏', '秋', '冬']);
    r.on('data', (chunk) => console.log('1. data:', chunk));
    r.on('end', () => {
      console.log('1. end');
      resolve();
    });
  });

  // 2. 自定义 Readable：push() 填数据，push(null) 结束
  let i = 0;
  const counter = new Readable({
    read() {
      this.push(i < 3 ? String(i++) : null);
    },
  });
  await new Promise<void>((resolve) => {
    counter.on('data', (chunk) => console.log('2. push:', chunk.toString()));
    counter.on('end', resolve);
  });

  // 3. Writable：end() 关闭后触发 'finish'
  const buf: string[] = [];
  const w = new Writable({
    write(chunk, _enc, callback) {
      buf.push(chunk.toString());
      callback(); // callback(err) 表示失败
    },
  });
  w.write('Hello');
  w.write(' ');
  w.end('Stream');
  await new Promise<void>((resolve) => w.once('finish', resolve));
  console.log('3. finish:', buf.join(''));

  // 4. pipe：可读流数据自动流向可写流
  const out: string[] = [];
  const dst = new Writable({
    write(chunk, _enc, callback) {
      out.push(chunk.toString());
      callback();
    },
  });
  await new Promise<void>((resolve) =>
    Readable.from(['a', 'b', 'c']).pipe(dst).once('finish', resolve)
  );
  console.log('4. pipe:', out.join(''));

  // 5. pipeline（推荐）：串联多个流，自动处理错误/背压
  const via: string[] = [];
  await pipeline(
    Readable.from(['pipe', 'line']),
    new Writable({
      write(chunk, _enc, callback) {
        via.push(chunk.toString());
        callback();
      },
    })
  );
  console.log('5. pipeline:', via.join(''));

  // 6. Transform：读入 → 加工 → 输出
  const upper = new Transform({
    transform(chunk, _enc, callback) {
      callback(null, chunk.toString().toUpperCase()); // (错误, 转换结果)
    },
  });
  const result: string[] = [];
  await pipeline(
    Readable.from(['hello ', 'transform']),
    upper,
    new Writable({
      write(chunk, _enc, callback) {
        result.push(chunk.toString());
        callback();
      },
    })
  );
  console.log('6. Transform:', result.join(''));

  // 7. Duplex：可读 + 可写，两端互不相通（Transform 则相通）
  const duplex = new Duplex({
    write(chunk, _enc, callback) {
      console.log('7. 写端收到:', chunk.toString());
      callback();
    },
    read() {
      this.push('读端数据');
      this.push(null);
    },
  });
  await new Promise<void>((resolve) => {
    duplex.write('写端数据');
    duplex.end();
    duplex.on('data', (chunk) => console.log('7. 读端发出:', chunk.toString()));
    duplex.on('end', resolve);
  });

  // 8. 文件流复制：分块读写，内存占用恒定，适合大文件
  const big = path.join(TMP, 'big.txt');
  fs.writeFileSync(big, 'A'.repeat(1024 * 1024));
  await pipeline(fs.createReadStream(big), fs.createWriteStream(path.join(TMP, 'copy.txt')));
  console.log('8. 复制完成:', fs.statSync(path.join(TMP, 'copy.txt')).size, '字节');

  // 9. 背压：write() 返回 false 时等 'drain' 再继续
  await new Promise<void>((resolve) => {
    const slow = new Writable({
      highWaterMark: 4, // 内部缓冲区上限（水位线）
      write(_chunk, _enc, callback) {
        setTimeout(callback, 50); // 模拟慢速写入
      },
    });
    console.log('9. 超过水位线:', slow.write('12345678') === false);
    slow.on('drain', () => {
      console.log('9. drain：缓冲区已排空');
      slow.end(() => resolve());
    });
  });
}

// 入口：建目录 → 演示 → 清理
(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  try {
    await main();
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.log('临时目录已清理');
  }
})();
