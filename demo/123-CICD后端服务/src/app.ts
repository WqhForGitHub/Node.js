import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * CICD后端服务
 * 流水线定义、触发运行、stage 状态流转、取消运行
 */
// ---- 模型 ----
type StageStatus = 'pending' | 'running' | 'success' | 'failed';
interface Pipeline {
  id: number;
  name: string;
  stages: string[];
  createdAt: number;
}
interface StageRun {
  name: string;
  status: StageStatus;
  startedAt?: number;
  finishedAt?: number;
}
interface PipelineRun {
  id: number;
  pipelineId: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled';
  stages: StageRun[];
  startedAt: number;
  finishedAt?: number;
}
// ---- Repository 层 ----
class PipelineRepository {
  private pipelines: Pipeline[] = [];
  private runs: PipelineRun[] = [];
  private seqP = 1;
  private seqR = 1;
  create(name: string, stages: string[]) {
    const p: Pipeline = { id: this.seqP++, name, stages, createdAt: Date.now() };
    this.pipelines.push(p);
    return p;
  }
  findPipeline(id: number) {
    return this.pipelines.find((p) => p.id === id);
  }
  createRun(pipelineId: number, stages: string[]): PipelineRun {
    const r: PipelineRun = {
      id: this.seqR++,
      pipelineId,
      status: 'pending',
      stages: stages.map((name) => ({ name, status: 'pending' as StageStatus })),
      startedAt: Date.now(),
    };
    this.runs.push(r);
    return r;
  }
  findRun(runId: number) {
    return this.runs.find((r) => r.id === runId);
  }
  runsByPipeline(pipelineId: number) {
    return this.runs.filter((r) => r.pipelineId === pipelineId);
  }
}
// ---- Service 层 ----
class PipelineService {
  constructor(private repo: PipelineRepository) {}
  define(body: any) {
    if (!body || !body.name || !Array.isArray(body.stages) || body.stages.length === 0) {
      throw new Error('参数缺失: name/stages');
    }
    return this.repo.create(body.name, body.stages);
  }
  run(pipelineId: number) {
    const p = this.repo.findPipeline(pipelineId);
    if (!p) throw new Error('not found');
    const r = this.repo.createRun(pipelineId, p.stages);
    // mock 按 stage 顺序执行
    r.status = 'running';
    for (const s of r.stages) {
      s.status = 'running';
      s.startedAt = Date.now();
      s.status = 'success';
      s.finishedAt = Date.now();
    }
    r.status = 'success';
    r.finishedAt = Date.now();
    return r;
  }
  getRun(runId: number) {
    return this.repo.findRun(runId);
  }
  history(pipelineId: number) {
    if (!this.repo.findPipeline(pipelineId)) throw new Error('not found');
    return this.repo.runsByPipeline(pipelineId);
  }
  cancel(runId: number) {
    const r = this.repo.findRun(runId);
    if (!r) throw new Error('not found');
    if (r.status === 'success' || r.status === 'failed') throw new Error('运行已结束，无法取消');
    r.status = 'canceled';
    r.finishedAt = Date.now();
    r.stages.forEach((s) => { if (s.status === 'pending' || s.status === 'running') s.status = 'failed'; });
    return r;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new PipelineService(new PipelineRepository());

// 定义流水线
router.post('/api/pipelines', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.define(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400; ctx.body = { message: e.message };
  }
});
// 触发运行
router.post('/api/pipelines/:id/run', (ctx) => {
  try {
    ctx.body = service.run(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message };
  }
});
// 运行详情
router.get('/api/runs/:runId', (ctx) => {
  const r = service.getRun(Number(ctx.params.runId));
  if (!r) { ctx.status = 404; ctx.body = { message: 'not found' }; return; }
  ctx.body = r;
});
// 流水线历史运行
router.get('/api/pipelines/:id/runs', (ctx) => {
  try { ctx.body = service.history(Number(ctx.params.id)); }
  catch (e: any) { ctx.status = 404; ctx.body = { message: e.message }; }
});
// 取消运行
router.post('/api/runs/:runId/cancel', (ctx) => {
  try { ctx.body = service.cancel(Number(ctx.params.runId)); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[CICD后端服务] running at http://localhost:' + PORT));
