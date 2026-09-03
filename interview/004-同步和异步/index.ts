/**
 * 004 - Node.js 中，同步和异步代码有什么区别？
 *
 * 同步（Synchronous）：代码按顺序执行，当前操作完成后才执行下一行，会阻塞
 * 异步（Asynchronous）：发起操作后立即返回，结果通过回调/Promise 稍后交付，不阻塞
 */

import { readFileSync, readFile } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';

// ============================================================
// 1. 同步代码：阻塞式，后面的代码必须等待
// ============================================================
console.log('=== 1. 同步代码（阻塞式） ===');
const syncStart: number = Date.now();
const syncContent: string = readFileSync(__filename, 'utf-8'); // 阻塞直到读完
console.log(
  `同步读取本文件成功，长度 ${syncContent.length} 字符，耗时 ${Date.now() - syncStart}ms`
);
console.log('这一行必须等同步读取完成后才会执行\n');

// ============================================================
// 2. 异步代码（回调风格）：发起后立即返回，结果稍后通过回调交付
// ============================================================
console.log('=== 2. 异步代码（回调风格，非阻塞） ===');
console.log('① 发起异步读取');
readFile(__filename, 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(`③ 回调执行：读到 ${data.length} 字符`);
});
console.log('② 发起后立即继续执行，没有被阻塞\n');

// ============================================================
// 3. 异步代码（Promise + async/await 风格）
//    await 只是"写法上像同步"，本质仍是异步，不阻塞事件循环
// ============================================================
console.log('=== 3. 异步代码（Promise / async-await） ===');

async function main(): Promise<void> {
  console.log('① 开始 await 读取');
  const content: string = await readFileAsync(__filename, 'utf-8');
  console.log(`② await 拿到结果：${content.length} 字符`);
}

main();

// ============================================================
// 4. 执行顺序观察：同步代码 -> 微任务 -> 宏任务
// ============================================================
console.log('\n=== 4. 执行顺序观察 ===');
console.log('1. 同步代码');

setTimeout(() => {
  console.log('4. setTimeout 回调（宏任务，timers 阶段）');
}, 0);

Promise.resolve().then(() => {
  console.log('3. Promise 回调（微任务，同步代码后立即执行）');
});

console.log('2. 同步代码结束\n');

// ============================================================
// 5. 同步阻塞的危害：CPU 密集操作会卡住事件循环
//    阻塞期间，上面已到期的 setTimeout 回调也无法执行！
// ============================================================
console.log('=== 5. 同步阻塞的危害 ===');
console.log('开始同步阻塞 1000ms（模拟 CPU 密集任务）...');
const blockStart: number = Date.now();
while (Date.now() - blockStart < 1000) {
  // 空循环：事件循环被完全阻塞，期间无法处理任何请求和事件
}
console.log(`阻塞结束，耗时 ${Date.now() - blockStart}ms`);
console.log('注意：上面第 4 条 setTimeout 日志直到阻塞结束才输出');
