/**
 * Demo 8 - readline 逐行读取（逐行读流 / 命令行问答 / 单行刷新）
 * 运行：node "demo/02. 核心内置模块 API/04. stream、readline、tty/8. readline.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PassThrough } = require('node:stream') as typeof import('node:stream');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const readline = require('node:readline') as typeof import('node:readline');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rlPromises = require('node:readline/promises') as typeof import('node:readline/promises');

const TMP = path.join(__dirname, 'tmp');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const file = path.join(TMP, 'notes.txt');
  fs.writeFileSync(file, '春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少');

  // 1. 逐行读取：createInterface + 'line' 事件
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: fs.createReadStream(file) });
    rl.on('line', (line) => console.log('1. line:', line));
    rl.on('close', () => resolve()); // EOF 时触发
  });

  // 2. for await：interface 是异步迭代器
  const rl2 = readline.createInterface({ input: fs.createReadStream(file) });
  let count = 0;
  for await (const line of rl2) {
    count += line.length;
  }
  rl2.close();
  console.log('2. for await 共', count, '个字符');

  // 3. question 问答：readline/promises 提供 Promise 版（PassThrough 模拟键盘输入）
  const input = new PassThrough();
  const rl3 = rlPromises.createInterface({ input, output: process.stdout });
  const answer = rl3.question('3. 你叫什么名字？ ');
  input.write('Wqh\n');
  console.log('3. 你好，' + (await answer) + '！');
  rl3.close();

  // 4. clearLine + cursorTo：单行刷新（进度条原理）
  for (let p = 0; p <= 100; p += 20) {
    readline.clearLine(process.stdout, 0); // 0=整行 -1=左侧 1=右侧
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`4. 进度 ${p}%`);
    await sleep(60);
  }
  process.stdout.write('\n');

  // 5. 逐行加工：读 → 转换 → 写，内存友好
  const dst = fs.createWriteStream(path.join(TMP, 'upper.txt'));
  const rl5 = readline.createInterface({ input: fs.createReadStream(file) });
  rl5.on('line', (line) => dst.write(line.toUpperCase() + '\n'));
  await new Promise<void>((resolve) => rl5.once('close', () => dst.end(resolve)));
  console.log('5. 转大写:', JSON.stringify(fs.readFileSync(path.join(TMP, 'upper.txt'), 'utf-8')));
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
