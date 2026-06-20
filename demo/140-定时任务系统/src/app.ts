import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 定时任务系统
 * 简化 cron 任务调度，按 intervalSec 轮询到期任务，记录执行历史
 */

// ---- 类型定义 ----
interface CronJob {
  id: string;
  name: string;
  cron: string; // cron 表达式字符串（保留字段）
  intervalSec: number; // 简化：固定间隔秒数
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
}

interface JobRun {
  id: string;
  jobId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'failed';
  error?: string;
}

// ---- Repository 层 ----
class CronRepository {
  private jobs: Map<string, CronJob> = new Map();
  private runs: JobRun[] = [];

  insertJob(j: CronJob): void {
    this.jobs.set(j.id, j);
  }

  findJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  allJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  removeJob(id: string): boolean {
    return this.jobs.delete(id);
  }

  addRun(run: JobRun): void {
    this.runs.push(run);
  }

  updateRun(run: JobRun): void {
    const idx = this.runs.findIndex((r) => r.id === run.id);
    if (idx >= 0) this.runs[idx] = run;
  }

  runsByJob(jobId: string): JobRun[] {
    return this.runs.filter((r) => r.jobId === jobId).sort((a, b) => b.startTime - a.startTime);
  }
}

// ---- Service 层 ----
class CronService {
  constructor(private repo: CronRepository) {}

  create(data: any): CronJob {
    if (!data.name) throw { status: 400, message: 'name required' };
    if (data.intervalSec === undefined) throw { status: 400, message: 'intervalSec required' };
    const intervalSec = Number(data.intervalSec);
    if (Number.isNaN(intervalSec) || intervalSec <= 0)
      throw { status: 400, message: 'invalid intervalSec' };
    const job: CronJob = {
      id: crypto.randomBytes(8).toString('hex'),
      name: data.name,
      cron: data.cron || '',
      intervalSec,
      enabled: data.enabled !== false,
      nextRunAt: data.enabled !== false ? Date.now() + intervalSec * 1000 : undefined,
      createdAt: Date.now(),
    };
    this.repo.insertJob(job);
    return job;
  }

  update(id: string, data: any): CronJob {
    const j = this.repo.findJob(id);
    if (!j) throw { status: 404, message: 'job not found' };
    if (data.name) j.name = data.name;
    if (data.cron !== undefined) j.cron = data.cron;
    if (data.intervalSec !== undefined) {
      const n = Number(data.intervalSec);
      if (Number.isNaN(n) || n <= 0) throw { status: 400, message: 'invalid intervalSec' };
      j.intervalSec = n;
    }
    if (data.enabled !== undefined) {
      j.enabled = !!data.enabled;
      if (j.enabled && !j.nextRunAt) j.nextRunAt = Date.now() + j.intervalSec * 1000;
      if (!j.enabled) j.nextRunAt = undefined;
    }
    return j;
  }

  list(): CronJob[] {
    return this.repo.allJobs();
  }

  remove(id: string): void {
    if (!this.repo.removeJob(id)) throw { status: 404, message: 'job not found' };
  }

  // 手动触发一次
  runOnce(id: string): JobRun {
    const j = this.repo.findJob(id);
    if (!j) throw { status: 404, message: 'job not found' };
    return this.execute(j);
  }

  runs(id: string): JobRun[] {
    const j = this.repo.findJob(id);
    if (!j) throw { status: 404, message: 'job not found' };
    return this.repo.runsByJob(id);
  }

  // 执行任务并记录 run
  private execute(j: CronJob): JobRun {
    const run: JobRun = {
      id: crypto.randomBytes(8).toString('hex'),
      jobId: j.id,
      startTime: Date.now(),
      status: 'running',
    };
    this.repo.addRun(run);
    // 模拟执行：500ms 后成功
    setTimeout(() => {
      run.status = 'success';
      run.endTime = Date.now();
      this.repo.updateRun(run);
    }, 500);
    return run;
  }

  // 后台轮询：检查到期 enabled 任务并触发
  tick(): void {
    const now = Date.now();
    for (const j of this.repo.allJobs()) {
      if (!j.enabled) continue;
      if (j.nextRunAt && now >= j.nextRunAt) {
        this.execute(j);
        j.lastRunAt = now;
        j.nextRunAt = now + j.intervalSec * 1000;
      }
    }
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new CronService(new CronRepository());

// 后台 setInterval 每 1s 检查到期任务
setInterval(() => {
  try {
    service.tick();
  } catch (e) {
    /* 忽略 */
  }
}, 1000);

// POST /api/jobs - 创建定时任务
router.post('/api/jobs', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// PUT /api/jobs/:id - 更新
router.put('/api/jobs/:id', (ctx) => {
  try {
    ctx.body = service.update(ctx.params.id, (ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/jobs - 列表
router.get('/api/jobs', (ctx) => {
  ctx.body = service.list();
});

// DELETE /api/jobs/:id - 删除
router.delete('/api/jobs/:id', (ctx) => {
  try {
    service.remove(ctx.params.id);
    ctx.status = 204;
    ctx.body = null;
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/jobs/:id/run - 手动触发
router.post('/api/jobs/:id/run', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.runOnce(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/jobs/:id/runs - 执行历史
router.get('/api/jobs/:id/runs', (ctx) => {
  try {
    ctx.body = service.runs(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[定时任务系统] running at http://localhost:' + PORT);
});
