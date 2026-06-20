import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 异步任务处理器
 * 异步任务 + 状态轮询，setInterval 模拟后台处理（pending→processing→done/failed）
 */

// ---- 类型定义 ----
type TaskStatus = 'pending' | 'processing' | 'done' | 'failed' | 'canceled';

interface Task {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  result?: any;
  error?: string;
  attempts: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

// ---- Repository 层 ----
class TaskRepository {
  private tasks: Map<string, Task> = new Map();

  insert(t: Task): void {
    this.tasks.set(t.id, t);
  }

  findById(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  findAll(): Task[] {
    return Array.from(this.tasks.values());
  }

  pending(): Task[] {
    return this.findAll().filter((t) => t.status === 'pending');
  }
}

// ---- Service 层 ----
class TaskService {
  constructor(private repo: TaskRepository) {}

  submit(data: any): Task {
    if (!data.type) throw { status: 400, message: 'task type required' };
    const task: Task = {
      id: crypto.randomBytes(8).toString('hex'),
      type: data.type,
      payload: data.payload,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };
    this.repo.insert(task);
    return task;
  }

  get(id: string): Task {
    const t = this.repo.findById(id);
    if (!t) throw { status: 404, message: 'task not found' };
    return t;
  }

  list(filter: { type?: string; status?: string }): Task[] {
    let list = this.repo.findAll();
    if (filter.type) list = list.filter((t) => t.type === filter.type);
    if (filter.status) list = list.filter((t) => t.status === filter.status);
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }

  cancel(id: string): Task {
    const t = this.get(id);
    if (t.status !== 'pending' && t.status !== 'processing') {
      throw { status: 400, message: 'only pending/processing task can be canceled' };
    }
    t.status = 'canceled';
    t.finishedAt = Date.now();
    return t;
  }

  retry(id: string): Task {
    const t = this.get(id);
    if (t.status !== 'failed') throw { status: 400, message: 'only failed task can retry' };
    t.status = 'pending';
    t.error = undefined;
    t.finishedAt = undefined;
    return t;
  }

  // 后台处理：取出 pending 任务模拟执行
  processOne(): void {
    const pending = this.repo.pending();
    if (!pending.length) return;
    const t = pending[0];
    t.status = 'processing';
    t.startedAt = Date.now();
    t.attempts++;
    // 模拟执行：根据 type 决定成败
    setTimeout(() => {
      if (t.status !== 'processing') return; // 已被取消
      const fail = t.type === 'fail' || (t.payload && t.payload.shouldFail);
      if (fail) {
        t.status = 'failed';
        t.error = 'simulated failure';
      } else {
        t.status = 'done';
        t.result = { processed: true, type: t.type, attempts: t.attempts };
      }
      t.finishedAt = Date.now();
    }, 500);
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new TaskService(new TaskRepository());

// 后台 setInterval 模拟任务处理（每 200ms 检查一次）
setInterval(() => {
  try {
    service.processOne();
  } catch (e) {
    /* 忽略 */
  }
}, 200);

// POST /api/tasks - 提交任务
router.post('/api/tasks', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.submit((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/tasks - 过滤列表
router.get('/api/tasks', (ctx) => {
  const q = ctx.query as any;
  ctx.body = service.list({ type: q.type, status: q.status });
});

// GET /api/tasks/:id - 查询状态
router.get('/api/tasks/:id', (ctx) => {
  try {
    ctx.body = service.get(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/tasks/:id/cancel - 取消
router.post('/api/tasks/:id/cancel', (ctx) => {
  try {
    ctx.body = service.cancel(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/tasks/:id/retry - 重试
router.post('/api/tasks/:id/retry', (ctx) => {
  try {
    ctx.body = service.retry(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[异步任务处理器] running at http://localhost:' + PORT);
});
