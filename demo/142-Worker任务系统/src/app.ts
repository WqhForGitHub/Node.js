import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * Worker任务系统
 * worker 池 + job 执行，提交 job 自动分配给空闲 worker，worker 拉取自己的 job 执行并回传结果
 */
// ---- 类型定义 ----
interface Worker {
  id: number;
  name: string;
  concurrency: number; // 并发上限
  runningJobs: number[]; // 当前正在执行的 jobId 列表
  createdAt: number;
}
interface Job {
  id: number;
  workerId: number | null;
  type: string;
  payload: any;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result: any;
  createdAt: number;
}
// ---- WorkerPool 类 ----
class WorkerPool {
  private workers: Worker[] = [];
  private jobs: Job[] = [];
  private workerSeq = 1;
  private jobSeq = 1;
  // 注册 worker
  registerWorker(name: string, concurrency: number): Worker {
    if (!name || !concurrency) throw new Error('参数缺失: name, concurrency');
    const w: Worker = {
      id: this.workerSeq++,
      name,
      concurrency,
      runningJobs: [],
      createdAt: Date.now(),
    };
    this.workers.push(w);
    return w;
  }
  // 提交 job，自动分配给空闲 worker
  submitJob(type: string, payload: any): Job {
    if (!type) throw new Error('参数缺失: type');
    const idle = this.workers.find((w) => w.runningJobs.length < w.concurrency);
    const job: Job = {
      id: this.jobSeq++,
      workerId: idle ? idle.id : null,
      type,
      payload,
      status: idle ? 'running' : 'queued',
      result: null,
      createdAt: Date.now(),
    };
    if (idle) idle.runningJobs.push(job.id);
    this.jobs.push(job);
    return job;
  }
  // worker 拉取自己的 job 执行并回传结果
  pollAndExecute(workerId: number, result: any): Job {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) throw new Error('worker 不存在');
    // 先尝试取一个分配给自己但还未开始的 job
    let job = this.jobs.find((j) => j.workerId === workerId && j.status === 'queued');
    if (!job) {
      // 没有自己的 queued job，则取一个无 worker 的 job 分配给自己
      job = this.jobs.find((j) => j.workerId === null && j.status === 'queued');
      if (job) {
        job.workerId = workerId;
        job.status = 'running';
        worker.runningJobs.push(job.id);
      }
    }
    if (!job) throw new Error('无可执行 job');
    // mock 执行：直接回传结果
    job.status = result && result.error ? 'failed' : 'succeeded';
    job.result = result;
    worker.runningJobs = worker.runningJobs.filter((id) => id !== job!.id);
    return job;
  }
  getJob(id: number) {
    return this.jobs.find((j) => j.id === id);
  }
  workerStatus(id: number) {
    const w = this.workers.find((x) => x.id === id);
    if (!w) throw new Error('worker 不存在');
    return {
      id: w.id,
      name: w.name,
      concurrency: w.concurrency,
      currentJobs: w.runningJobs.length,
      status: w.runningJobs.length >= w.concurrency ? 'busy' : 'idle',
    };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const pool = new WorkerPool();

// POST /api/workers - 注册 worker
router.post('/api/workers', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = pool.registerWorker(b.name, Number(b.concurrency));
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/jobs - 提交 job
router.post('/api/jobs', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = pool.submitJob(b.type, b.payload);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/workers/:id/poll - worker 拉取 job 执行并回传结果
router.post('/api/workers/:id/poll', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = pool.pollAndExecute(Number(ctx.params.id), b.result);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/jobs/:id - job 详情
router.get('/api/jobs/:id', (ctx) => {
  const j = pool.getJob(Number(ctx.params.id));
  if (!j) {
    ctx.status = 404;
    ctx.body = { message: 'job 不存在' };
    return;
  }
  ctx.body = j;
});
// GET /api/workers/:id/status - worker 状态
router.get('/api/workers/:id/status', (ctx) => {
  try {
    ctx.body = pool.workerStatus(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[Worker任务系统] running at http://localhost:' + PORT);
});
