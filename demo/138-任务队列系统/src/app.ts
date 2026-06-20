import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 任务队列系统
 * 队列 + 消费，FIFO 入队/出队，job 状态管理
 */

// ---- 类型定义 ----
type JobStatus = 'waiting' | 'processing' | 'done' | 'failed';

interface Job {
  id: string;
  queueName: string;
  type: string;
  payload: any;
  status: JobStatus;
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: any;
  error?: string;
}

interface Queue {
  name: string;
  waiting: Job[]; // FIFO
  createdAt: number;
}

// ---- Repository 层 ----
class QueueRepository {
  private queues: Map<string, Queue> = new Map();
  private jobs: Map<string, Job> = new Map(); // 所有 job 索引

  createQueue(name: string): Queue {
    const q: Queue = { name, waiting: [], createdAt: Date.now() };
    this.queues.set(name, q);
    return q;
  }

  findQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  enqueue(queueName: string, job: Job): void {
    const q = this.findQueue(queueName);
    if (!q) return;
    q.waiting.push(job);
    this.jobs.set(job.id, job);
  }

  // FIFO 出队
  dequeue(queueName: string): Job | undefined {
    const q = this.findQueue(queueName);
    if (!q) return undefined;
    const job = q.waiting.shift();
    if (job) {
      job.status = 'processing';
      job.startedAt = Date.now();
    }
    return job;
  }

  findJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  queueSize(name: string): number {
    const q = this.findQueue(name);
    return q ? q.waiting.length : 0;
  }
}

// ---- Service 层 ----
class QueueService {
  constructor(private repo: QueueRepository) {}

  createQueue(data: any): Queue {
    if (!data.name) throw { status: 400, message: 'queue name required' };
    if (this.repo.findQueue(data.name)) throw { status: 400, message: 'queue already exists' };
    return this.repo.createQueue(data.name);
  }

  enqueue(queueName: string, data: any): Job {
    const q = this.repo.findQueue(queueName);
    if (!q) throw { status: 404, message: 'queue not found' };
    if (!data.type) throw { status: 400, message: 'job type required' };
    const job: Job = {
      id: crypto.randomBytes(8).toString('hex'),
      queueName,
      type: data.type,
      payload: data.payload,
      status: 'waiting',
      enqueuedAt: Date.now(),
    };
    this.repo.enqueue(queueName, job);
    return job;
  }

  dequeue(queueName: string): Job {
    const q = this.repo.findQueue(queueName);
    if (!q) throw { status: 404, message: 'queue not found' };
    const job = this.repo.dequeue(queueName);
    if (!job) throw { status: 404, message: 'no job in queue' };
    return job;
  }

  size(queueName: string): number {
    const q = this.repo.findQueue(queueName);
    if (!q) throw { status: 404, message: 'queue not found' };
    return this.repo.queueSize(queueName);
  }

  getJob(queueName: string, id: string): Job {
    const q = this.repo.findQueue(queueName);
    if (!q) throw { status: 404, message: 'queue not found' };
    const job = this.repo.findJob(id);
    if (!job || job.queueName !== queueName) throw { status: 404, message: 'job not found' };
    return job;
  }

  complete(queueName: string, id: string, data: any): Job {
    const job = this.getJob(queueName, id);
    if (job.status !== 'processing' && job.status !== 'waiting') {
      throw { status: 400, message: 'job already finished' };
    }
    job.status = 'done';
    job.finishedAt = Date.now();
    job.result = data.result;
    return job;
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new QueueService(new QueueRepository());

// POST /api/queues - 创建队列
router.post('/api/queues', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.createQueue(ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/queues/:name/enqueue - 入队
router.post('/api/queues/:name/enqueue', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.enqueue(ctx.params.name, ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/queues/:name/dequeue - 出队
router.post('/api/queues/:name/dequeue', (ctx) => {
  try {
    ctx.body = service.dequeue(ctx.params.name);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/queues/:name/size - 队列长度
router.get('/api/queues/:name/size', (ctx) => {
  try {
    ctx.body = { queue: ctx.params.name, size: service.size(ctx.params.name) };
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/queues/:name/jobs/:id - job 状态
router.get('/api/queues/:name/jobs/:id', (ctx) => {
  try {
    ctx.body = service.getJob(ctx.params.name, ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/queues/:name/jobs/:id/complete - 标记完成
router.post('/api/queues/:name/jobs/:id/complete', (ctx) => {
  try {
    ctx.body = service.complete(ctx.params.name, ctx.params.id, ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[任务队列系统] running at http://localhost:' + PORT);
});
