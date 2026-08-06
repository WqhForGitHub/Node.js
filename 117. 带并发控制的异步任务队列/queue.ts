/**
 * 带并发控制的异步任务队列
 *
 * - 最多同时执行 concurrency 个任务
 * - 任务完成后自动调度下一个
 * - 支持 add、awaitDrain
 *
 * 运行：npx ts-node queue.ts
 */
type Task<T> = () => Promise<T>;

export class AsyncTaskQueue<T> {
  private pending: Array<{ task: Task<T>; resolve: (v: T) => void; reject: (e: any) => void }> = [];
  private active = 0;
  private drainResolvers: Array<() => void> = [];

  constructor(private concurrency = 4) {
    if (concurrency <= 0) throw new Error('concurrency must > 0');
  }

  add(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.tick();
    });
  }

  private tick() {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active++;
      Promise.resolve()
        .then(job.task)
        .then(
          (v) => {
            this.active--;
            job.resolve(v);
            this.afterJob();
          },
          (e) => {
            this.active--;
            job.reject(e);
            this.afterJob();
          },
        );
    }
  }

  private afterJob() {
    this.tick();
    if (this.active === 0 && this.pending.length === 0) {
      const arr = this.drainResolvers;
      this.drainResolvers = [];
      arr.forEach((r) => r());
    }
  }

  drain(): Promise<void> {
    if (this.active === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise((r) => this.drainResolvers.push(r));
  }

  get state() {
    return { active: this.active, pending: this.pending.length };
  }
}

async function main() {
  const q = new AsyncTaskQueue<number>(3);
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < 10; i++) {
    const idx = i;
    q.add(async () => {
      const ms = 200 + Math.floor(Math.random() * 500);
      await delay(ms);
      console.log(`任务 ${idx} 完成 (${ms}ms)  当前并发=${q.state.active}`);
      return idx;
    });
  }
  console.log('已加入 10 个任务...');
  await q.drain();
  console.log('全部完成');
}

main().catch(console.error);