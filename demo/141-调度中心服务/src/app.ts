import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 调度中心服务
 * 分布式任务调度中心（mock 实现），支持调度器注册、worker 注册、触发执行与负载均衡分配
 */
// ---- 类型定义 ----
interface Scheduler {
  id: number;
  name: string;
  intervalSec: number;
  payload: any;
  createdAt: number;
}
interface Worker {
  id: number;
  name: string;
  capacity: number; // 最大并发数
  currentLoad: number; // 当前执行中任务数
  createdAt: number;
}
interface Execution {
  id: number;
  schedulerId: number;
  workerId: number;
  payload: any;
  status: 'pending' | 'running' | 'done';
  createdAt: number;
}
// ---- Repository 层 ----
class SchedulerRepository {
  private list: Scheduler[] = [];
  private seq = 1;
  create(data: { name: string; intervalSec: number; payload: any }) {
    const s: Scheduler = { id: this.seq++, createdAt: Date.now(), ...data };
    this.list.push(s);
    return s;
  }
  findById(id: number) {
    return this.list.find((s) => s.id === id);
  }
  findAll() {
    return this.list;
  }
}
class WorkerRepository {
  private list: Worker[] = [];
  private seq = 1;
  create(data: { name: string; capacity: number }) {
    const w: Worker = { id: this.seq++, currentLoad: 0, createdAt: Date.now(), ...data };
    this.list.push(w);
    return w;
  }
  findById(id: number) {
    return this.list.find((w) => w.id === id);
  }
  findAll() {
    return this.list;
  }
  // 找最闲的 worker：currentLoad 最小，且未达容量上限
  findLeastBusy() {
    const avail = this.list.filter((w) => w.currentLoad < w.capacity);
    if (avail.length === 0) return undefined;
    return avail.reduce((min, w) => (w.currentLoad < min.currentLoad ? w : min), avail[0]);
  }
}
class ExecutionRepository {
  private list: Execution[] = [];
  private seq = 1;
  create(schedulerId: number, workerId: number, payload: any) {
    const e: Execution = {
      id: this.seq++,
      schedulerId,
      workerId,
      payload,
      status: 'running',
      createdAt: Date.now(),
    };
    this.list.push(e);
    return e;
  }
  findByScheduler(schedulerId: number) {
    return this.list.filter((e) => e.schedulerId === schedulerId);
  }
}
// ---- Service 层 ----
class SchedulerService {
  constructor(
    private schedulers: SchedulerRepository,
    private workers: WorkerRepository,
    private executions: ExecutionRepository,
  ) {}
  registerScheduler(data: any) {
    if (!data || !data.name || !data.intervalSec) throw new Error('参数缺失: name, intervalSec');
    return this.schedulers.create({ name: data.name, intervalSec: Number(data.intervalSec), payload: data.payload });
  }
  registerWorker(data: any) {
    if (!data || !data.name || !data.capacity) throw new Error('参数缺失: name, capacity');
    return this.workers.create({ name: data.name, capacity: Number(data.capacity) });
  }
  trigger(id: number) {
    const s = this.schedulers.findById(id);
    if (!s) throw new Error('scheduler 不存在');
    const w = this.workers.findLeastBusy();
    if (!w) throw new Error('无可用 worker');
    w.currentLoad++;
    const e = this.executions.create(s.id, w.id, s.payload);
    // mock 异步执行完成
    setTimeout(() => {
      e.status = 'done';
      const worker = this.workers.findById(w.id);
      if (worker) worker.currentLoad = Math.max(0, worker.currentLoad - 1);
    }, 500);
    return e;
  }
  listExecutions(id: number) {
    return this.executions.findByScheduler(id);
  }
  workerLoad(id: number) {
    const w = this.workers.findById(id);
    if (!w) throw new Error('worker 不存在');
    return { id: w.id, name: w.name, capacity: w.capacity, currentLoad: w.currentLoad, idle: w.currentLoad < w.capacity };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new SchedulerService(new SchedulerRepository(), new WorkerRepository(), new ExecutionRepository());

// POST /api/schedulers - 注册调度器
router.post('/api/schedulers', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.registerScheduler(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/workers - 注册 worker
router.post('/api/workers', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.registerWorker(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/schedulers/:id/trigger - 触发一次执行
router.post('/api/schedulers/:id/trigger', (ctx) => {
  try {
    ctx.body = service.trigger(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/schedulers/:id/executions - 执行历史
router.get('/api/schedulers/:id/executions', (ctx) => {
  ctx.body = service.listExecutions(Number(ctx.params.id));
});
// GET /api/workers/:id/load - worker 当前负载
router.get('/api/workers/:id/load', (ctx) => {
  try {
    ctx.body = service.workerLoad(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[调度中心服务] running at http://localhost:' + PORT);
});
