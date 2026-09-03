/**
 * 007 - 如何使用 Node.js 读取和写入文件？
 *
 * 核心：node:fs 模块，提供三套风格 API（以读取为例）：
 * 1. 同步：readFileSync / writeFileSync（阻塞，适合启动/脚本）
 * 2. 异步回调：readFile / writeFile（错误优先回调）
 * 3. Promise：fs/promises + async/await（推荐）
 */

import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  existsSync,
  writeFile,
  readFile,
} from 'node:fs';
import {
  writeFile as writeFileAsync,
  readFile as readFileAsync,
  appendFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { join } from 'node:path';

const dir: string = join(__dirname, 'output');
const file: string = join(dir, 'hello.txt');

// ============================================================
// 1. 同步 API：writeFileSync / appendFileSync / readFileSync
// ============================================================
console.log('=== 1. 同步 API ===');
if (!existsSync(dir)) {
  mkdirSync(dir); // 创建输出目录
}
writeFileSync(file, '第一行：Hello Node.js\n', 'utf-8'); // 写文件（覆盖）
appendFileSync(file, '第二行：追加的内容\n', 'utf-8'); // 追加写入
console.log('readFileSync 结果:');
console.log(readFileSync(file, 'utf-8'));

// ============================================================
// 2. 异步回调 API：writeFile / readFile（错误优先回调）
// ============================================================
console.log('=== 2. 异步回调 API ===');
writeFile(join(dir, 'callback.txt'), '回调风格写入的内容', 'utf-8', (err) => {
  if (err) {
    console.error('写入失败:', err.message);
    return;
  }
  readFile(join(dir, 'callback.txt'), 'utf-8', (err2, data) => {
    if (err2) {
      console.error('读取失败:', err2.message);
      return;
    }
    console.log('readFile 回调结果:', data);
  });
});

// ============================================================
// 3. Promise API（fs/promises）：配合 async/await，推荐写法
// ============================================================
(async (): Promise<void> => {
  console.log('\n=== 3. Promise API（fs/promises） ===');
  const promiseFile = join(dir, 'promise.txt');

  await writeFileAsync(promiseFile, 'Promise 风格写入\n', 'utf-8');
  await appendFile(promiseFile, 'Promise 风格追加\n', 'utf-8');

  const content: string = await readFileAsync(promiseFile, 'utf-8');
  console.log('fs/promises 读取结果:');
  console.log(content);

  // 读取目录
  const files: string[] = await readdir(dir);
  console.log('目录下所有文件:', files);

  // 查看文件信息
  const stats = await stat(promiseFile);
  console.log(`文件大小: ${stats.size} 字节，创建时间: ${stats.birthtime.toISOString()}`);

  // ============================================================
  // 4. 清理：递归删除整个 output 目录
  // ============================================================
  await rm(dir, { recursive: true, force: true });
  console.log('\n已删除演示目录 output/，演示完成');
})();
