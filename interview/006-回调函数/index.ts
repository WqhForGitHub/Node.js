/**
 * 006 - Node.js 中的回调函数是什么？
 *
 * 回调函数（Callback）：作为参数传递给另一个函数、
 * 在某个时机（通常是任务完成时）被"回头调用"的函数。
 *
 * Node.js 的异步 API 大量使用回调，约定为"错误优先回调"。
 */

import { readFile } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';

// ============================================================
// 1. 同步回调：数组方法里的参数就是回调，立即执行
// ============================================================
console.log('=== 1. 同步回调（立即执行） ===');
const nums: number[] = [1, 2, 3, 4, 5];
const doubled: number[] = nums.map((n: number) => n * 2); // (n) => n * 2 就是回调
console.log('map 回调结果:', doubled);
console.log(
  'filter 回调结果:',
  nums.filter((n: number) => n % 2 === 0)
);

// ============================================================
// 2. 异步回调：注册后不立即执行，任务完成时由事件循环触发
// ============================================================
console.log('\n=== 2. 异步回调（稍后触发） ===');
console.log('注册 100ms 后执行的回调...');
setTimeout(() => {
  console.log('回调被事件循环触发（约 100ms 后）');
}, 100);
console.log('注册完成，回调还没有执行\n');

// ============================================================
// 3. 错误优先回调（Error-first Callback）：Node.js 的核心约定
//    签名：callback(err, result)，err 为 null 表示成功
// ============================================================
console.log('=== 3. 错误优先回调 ===');

// 成功情况：err 为 null
readFile(__filename, 'utf-8', (err: NodeJS.ErrnoException | null, data: string) => {
  if (err) {
    console.error('读取失败:', err.message);
    return;
  }
  console.log(`成功：读到 ${data.length} 字符`);
});

// 失败情况：err 携带错误信息
readFile('不存在的文件.txt', 'utf-8', (err: NodeJS.ErrnoException | null) => {
  console.log('失败：err.code =', err?.code, '->', err?.message);
});

// ============================================================
// 4. 回调地狱（Callback Hell）：嵌套的异步回调，难以阅读维护
// ============================================================
console.log('\n=== 4. 回调地狱（反面示例） ===');

/** 模拟一个异步步骤 */
function step(n: number, callback: (err: Error | null, result?: string) => void): void {
  setTimeout(() => callback(null, `步骤${n}完成`), 50);
}

// 嵌套写法：层层缩进，错误处理重复，流程难以追踪
step(1, (err1, r1) => {
  if (err1) throw err1;
  step(2, (err2, r2) => {
    if (err2) throw err2;
    step(3, (err3, r3) => {
      if (err3) throw err3;
      console.log('嵌套结果:', r1, '/', r2, '/', r3);
    });
  });
});

// ============================================================
// 5. 解决方案：Promise + async/await（同样的逻辑，同步的写法）
// ============================================================
console.log('\n=== 5. 解决方案：async/await ===');

async function flow(): Promise<void> {
  const content: string = await readFileAsync(__filename, 'utf-8');
  console.log(`async/await 风格：读到 ${content.length} 字符，无嵌套`);
}

flow();
