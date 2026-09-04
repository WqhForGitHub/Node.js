/**
 * Demo 19 - worker_threads 模块（CPU 密集任务放子线程，不阻塞主线程）
 * 运行：node "demo/02. 核心内置模块 API/07. child_process、cluster、worker_threads、os/19-worker_thread.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const worker_threads = require('node:worker_threads') as typeof import('node:worker_threads');
const { Worker, isMainThread, parentPort, workerData, threadId } = worker_threads;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { once } = require('node:events') as typeof import('node:events');

// 递归斐波那契：纯 CPU 计算
const fib = (n: number): number => (n < 2 ? n : fib(n - 1) + fib(n - 2));

async function main(): Promise<void> {
  // 1. 创建 worker：运行本文件（worker 走底部 else 分支），workerData 为初始数据
  const worker = new Worker(__filename, { workerData: 40 });
  console.log('1. 主线程创建 worker，让它去算 fib(40)');

  // 2. worker 干重活的同时，主线程事件循环照常运转
  const tick = setInterval(() => console.log('2. 主线程仍在响应，未阻塞'), 300);
  const start = Date.now();

  // 3. message：收到 worker 发回的结果
  worker.on('message', (msg: string) => console.log(`3. ${msg}（耗时 ${Date.now() - start}ms）`));

  // 4. exit：worker 结束后收尾
  await once(worker, 'exit');
  clearInterval(tick);
  console.log('4. worker 已退出，演示结束');
}

if (isMainThread) {
  main();
} else {
  // ===== worker 线程：用 workerData 计算，postMessage 发回结果 =====
  const n = workerData as number;
  parentPort?.postMessage(`worker ${threadId} 算得 fib(${n}) = ${fib(n)}`);
}
