import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * GitHub Actions服务
 * workflow 注册、手动 dispatch、运行列表、job 状态、重跑失败 job
 */
type JobStatus = 'pending' | 'running' | 'success' | 'failed';
interface Workflow {
  id: number;
  repo: string;
  fileName: string;
  triggers: string[];
  createdAt: number;
}
interface Job {
  name: string;
  status: JobStatus;
  startedAt?: number;
  finishedAt?: number;
}
interface WorkflowRun {
  id: number;
  workflowId: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  jobs: Job[];
  startedAt: number;
  finishedAt?: number;
}
// ---- Repository 层 ----
class WorkflowRepository {
  private workflows: Workflow[] = [];
  private runs: WorkflowRun[] = [];
  private seqW = 1;
  private seqR = 1;
  create(repo: string, fileName: string, triggers: string[]) {
    const w: Workflow = { id: this.seqW++, repo, fileName, triggers, createdAt: Date.now() };
    this.workflows.push(w);
    return w;
  }
  findWorkflow(id: number) {
    return this.workflows.find((w) => w.id === id);
  }
  createRun(workflowId: number, jobs: string[]) {
    const r: WorkflowRun = {
      id: this.seqR++,
      workflowId,
      status: 'running',
      jobs: jobs.map((name) => ({ name, status: 'running' as JobStatus })),
      startedAt: Date.now(),
    };
    // mock 执行
    r.jobs.forEach((j) => { j.status = 'success'; j.startedAt = Date.now(); j.finishedAt = Date.now(); });
    r.status = 'success';
    r.finishedAt = Date.now();
    this.runs.push(r);
    return r;
  }
  findRun(runId: number) {
    return this.runs.find((r) => r.id === runId);
  }
  runsByWorkflow(workflowId: number) {
    return this.runs.filter((r) => r.workflowId === workflowId);
  }
}
// ---- Service 层 ----
class WorkflowService {
  constructor(private repo: WorkflowRepository) {}
  register(body: any) {
    if (!body || !body.repo || !body.fileName || !Array.isArray(body.triggers)) {
      throw new Error('参数缺失: repo/fileName/triggers');
    }
    return this.repo.create(body.repo, body.fileName, body.triggers);
  }
  dispatch(id: number) {
    const w = this.repo.findWorkflow(id);
    if (!w) throw new Error('not found');
    // mock 默认 3 个 job
    return this.repo.createRun(id, ['build', 'test', 'deploy']);
  }
  runs(workflowId: number) {
    if (!this.repo.findWorkflow(workflowId)) throw new Error('not found');
    return this.repo.runsByWorkflow(workflowId);
  }
  jobs(runId: number) {
    const r = this.repo.findRun(runId);
    if (!r) throw new Error('not found');
    return r.jobs;
  }
  rerun(runId: number) {
    const r = this.repo.findRun(runId);
    if (!r) throw new Error('not found');
    let count = 0;
    r.jobs.forEach((j) => {
      if (j.status === 'failed') {
        j.status = 'success';
        j.startedAt = Date.now();
        j.finishedAt = Date.now();
        count++;
      }
    });
    // 若所有 job 成功，整体标记成功
    if (r.jobs.every((j) => j.status === 'success')) {
      r.status = 'success';
      r.finishedAt = Date.now();
    }
    return { reran: count, run: r };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new WorkflowService(new WorkflowRepository());

// 注册 workflow
router.post('/api/workflows', (ctx) => {
  try { ctx.status = 201; ctx.body = service.register(ctx.request.body); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// 手动触发
router.post('/api/workflows/:id/dispatch', (ctx) => {
  try { ctx.body = service.dispatch(Number(ctx.params.id)); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});
// 运行列表
router.get('/api/workflows/:id/runs', (ctx) => {
  try { ctx.body = service.runs(Number(ctx.params.id)); }
  catch (e: any) { ctx.status = 404; ctx.body = { message: e.message }; }
});
// job 列表
router.get('/api/runs/:runId/jobs', (ctx) => {
  try { ctx.body = service.jobs(Number(ctx.params.runId)); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});
// 重新运行失败 job
router.post('/api/runs/:runId/rerun', (ctx) => {
  try { ctx.body = service.rerun(Number(ctx.params.runId)); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[GitHubActions服务] running at http://localhost:' + PORT));
