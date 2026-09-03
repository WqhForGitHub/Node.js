/**
 * 001 - 什么是 Node.js？
 *
 * Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境（Runtime），
 * 它让 JavaScript 能够脱离浏览器，运行在操作系统（服务端）上。
 *
 * 主要特点（本文件用代码逐个演示）：
 * 1. 基于 V8 引擎，执行速度快
 * 2. 事件驱动、非阻塞 I/O，适合高并发
 * 3. 单线程事件循环（主线程不做 I/O，I/O 交给底层线程池）
 * 4. 跨平台（Windows / macOS / Linux）
 * 5. 内置核心模块丰富，生态庞大
 *
 * 适用场景见 README.md
 */

import { versions, platform, arch, pid } from 'node:process';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// ============================================================
// 1. 基于 V8 引擎：查看运行时信息
// ============================================================
console.log('=== 1. Node.js 运行时信息（基于 V8 引擎） ===');
console.log('Node.js 版本:', versions.node);
console.log('V8 引擎版本: ', versions.v8);
console.log('操作系统:     ', platform, arch);
console.log('当前进程 PID: ', pid);

// ============================================================
// 2. 非阻塞 I/O：发起异步操作后，主线程立即继续执行
//    I/O 完成后，回调由事件循环调度执行
// ============================================================
console.log('\n=== 2. 非阻塞 I/O（异步操作不阻塞主线程） ===');
console.log('① 发起异步查询（当前目录信息）...');

stat('.').then((stats) => {
  console.log(`③ 异步查询完成（是目录: ${stats.isDirectory()}）`);
});

console.log('② 主线程继续执行，没有被文件操作阻塞');

// ============================================================
// 3. 单线程 + 事件循环：观察代码的实际执行顺序
//    同步代码 -> 微任务(Promise) -> 宏任务(setTimeout/setImmediate)
// ============================================================
console.log('\n=== 3. 单线程事件循环（观察执行顺序） ===');
console.log('1. 同步代码开始');

setTimeout(() => {
  console.log('4. setTimeout 回调（宏任务：timers 阶段）');
}, 0);

Promise.resolve().then(() => {
  console.log('3. Promise 回调（微任务：同步代码后立即执行）');
});

setImmediate(() => {
  console.log('5. setImmediate 回调（宏任务：check 阶段）');
});

console.log('2. 同步代码结束，把控制权交还给事件循环');

// ============================================================
// 4. 内置核心模块丰富：一行代码计算 SHA-256 哈希
// ============================================================
console.log('\n=== 4. 内置核心模块（crypto 计算哈希） ===');
const hash: string = createHash('sha256').update('Hello Node.js').digest('hex');
console.log('SHA-256("Hello Node.js") =', hash);
