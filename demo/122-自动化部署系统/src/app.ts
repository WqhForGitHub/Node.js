import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 自动化部署系统
 * 部署任务管理：创建/启动/回滚/查看日志
 */
// ---- Repository 层 ----
interface DeployTask {
  id: number;
  serviceName: string;
  image: string;
  env: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  previousImage?: string;
  logs: string[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}
class DeployRepository {
  private tasks: DeployTask[] = [];
  private seq = 1;
  create(data: { serviceName: string; image: string; env: string }) {
    const t: DeployTask = {
      id: this.seq++,
      serviceName: data.serviceName,
      image: data.image,
      env: data.env,
      status: 'pending',
      logs: [`任务创建: service=${data.serviceName} image=${data.image} env=${data.env}`],
      createdAt: Date.now(),
    };
    this.tasks.push(t);
    return t;
  }
  findAll(status?: string) {
    return status ? this.tasks.filter((t) => t.status === status) : this.tasks;
  }
  findById(id: number) {
    return this.tasks.find((t) => t.id === id);
  }
  update(id: number, patch: Partial<DeployTask>) {
    const t = this.findById(id);
    if (t) Object.assign(t, patch);
    return t;
  }
  appendLog(id: number, line: string) {
    const t = this.findById(id);
    if (t) t.logs.push(`[${new Date().toISOString()}] ${line}`);
  }
}
// ---- Service 层 ----
class DeployService {
  constructor(private repo: DeployRepository) {}
  create(body: any) {
    if (!body || !body.serviceName || !body.image || !body.env) {
      throw new Error('参数缺失: serviceName/image/env');
    }
    return this.repo.create(body);
  }
  list(status?: string) {
    return this.repo.findAll(status);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  start(id: number) {
    const t = this.repo.findById(id);
    if (!t) throw new Error('not found');
    if (t.status !== 'pending') throw new Error('当前状态不允许启动: ' + t.status);
    this.repo.update(id, { status: 'running', startedAt: Date.now() });
    this.repo.appendLog(id, '开始执行部署');
    this.repo.appendLog(id, `拉取镜像 ${t.image}`);
    this.repo.appendLog(id, '替换容器实例');
    // mock 部署成功
    this.repo.update(id, { status: 'success', finishedAt: Date.now() });
    this.repo.appendLog(id, '部署完成');
    return this.repo.findById(id);
  }
  rollback(id: number) {
    const t = this.repo.findById(id);
    if (!t) throw new Error('not found');
    if (!t.previousImage && t.status !== 'success') throw new Error('无可回滚版本');
    const prev = t.previousImage || t.image;
    this.repo.update(id, {
      status: 'rolled_back',
      previousImage: t.image,
      finishedAt: Date.now(),
    });
    this.repo.appendLog(id, `回滚到镜像 ${prev}`);
    return this.repo.findById(id);
  }
  logs(id: number) {
    const t = this.repo.findById(id);
    return t ? t.logs : undefined;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new DeployService(new DeployRepository());

// 创建部署任务
router.post('/api/deploy', (ctx) => {
  try {
    const t = service.create(ctx.request.body);
    ctx.status = 201;
    ctx.body = t;
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 任务列表（可按 status 过滤）
router.get('/api/deploys', (ctx) => {
  ctx.body = service.list(ctx.query.status as string | undefined);
});
// 任务详情
router.get('/api/deploys/:id', (ctx) => {
  const t = service.get(Number(ctx.params.id));
  if (!t) { ctx.status = 404; ctx.body = { message: 'not found' }; return; }
  ctx.body = t;
});
// 启动任务
router.post('/api/deploys/:id/start', (ctx) => {
  try {
    const t = service.start(Number(ctx.params.id));
    ctx.body = t;
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 回滚
router.post('/api/deploys/:id/rollback', (ctx) => {
  try {
    const t = service.rollback(Number(ctx.params.id));
    ctx.body = t;
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 部署日志
router.get('/api/deploys/:id/logs', (ctx) => {
  const logs = service.logs(Number(ctx.params.id));
  if (!logs) { ctx.status = 404; ctx.body = { message: 'not found' }; return; }
  ctx.body = { logs };
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[自动化部署系统] running at http://localhost:' + PORT));
