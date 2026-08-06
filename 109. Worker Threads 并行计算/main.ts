/**
 * 主线程：分配多段任务给多个 Worker，并行计算质数
 *
 * 运行：npx ts-node main.ts [workerCount] [rangeStart] [rangeEnd]
 * 例如：npx ts-node main.ts 4 1 1000000
 */
import * as path from 'path';
import * as workerThreads from 'worker_threads';

const { Worker, isMainThread, workerData, parentPort } = workerThreads;

if (isMainThread) {
  const workerCount = parseInt(process.argv[2] || '4', 10);
  const rangeStart = parseInt(process.argv[3] || '1', 10);
  const rangeEnd = parseInt(process.argv[4] || '1_000_000', 10);
  const span = rangeEnd - rangeStart + 1;
  const chunk = Math.ceil(span / workerCount);

  const workers: Promise<{ start: number; end: number; count: number; last: number }>[] = [];
  for (let i = 0; i < workerCount; i++) {
    const start = rangeStart + i * chunk;
    const end = Math.min(rangeStart + (i + 1) * chunk - 1, rangeEnd);
    if (start > end) continue;
    const w = new Worker(__filename, { workerData: { start, end } });
    workers.push(
      new Promise((resolve, reject) => {
        w.on('message', (m) => resolve(m));
        w.on('error', reject);
        w.on('exit', (code) => code !== 0 && reject(new Error(`worker exit ${code}`)));
      }),
    );
  }

  Promise.all(workers)
    .then((results) => {
      const total = results.reduce((s, r) => s + r.count, 0);
      console.log('各 worker 结果:');
      for (const r of results) console.log(`  [${r.start}-${r.end}] 质数 ${r.count} 个，最大: ${r.last}`);
      console.log(`总计质数 ${total} 个`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  // worker 线程：统计区间内质数
  const { start, end } = workerData as { start: number; end: number };

  function isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0) return false;
    const lim = Math.floor(Math.sqrt(n));
    for (let i = 3; i <= lim; i += 2) if (n % i === 0) return false;
    return true;
  }

  let count = 0;
  let last = 0;
  for (let n = start; n <= end; n++) {
    if (isPrime(n)) {
      count++;
      last = n;
    }
  }
  parentPort!.postMessage({ start, end, count, last });
}