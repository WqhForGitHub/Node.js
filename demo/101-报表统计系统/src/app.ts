import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 报表统计系统
 * 报表定义、数据生成、查询
 */
// ---- 类型 ----
interface Report { id: number; name: string; dimensions: string[]; metrics: string[]; }
interface ReportRow { reportId: number; dimension: string; metrics: Record<string, number>; generatedAt: number; }

// ---- Repository 层 ----
class ReportRepository {
  private reports: Report[] = [];
  private rows: ReportRow[] = [];
  findAll() { return this.reports; }
  findById(id: number) { return this.reports.find((r) => r.id === id); }
  create(data: { name: string; dimensions: string[]; metrics: string[] }) {
    const r: Report = { id: Date.now(), ...data };
    this.reports.push(r);
    return r;
  }
  addRows(rows: ReportRow[]) { this.rows.push(...rows); }
  findRows(reportId: number, dimension?: string) {
    return this.rows.filter((r) => r.reportId === reportId && (!dimension || r.dimension === dimension));
  }
}
// ---- Service 层 ----
class ReportService {
  constructor(private repo: ReportRepository) {}
  list() { return this.repo.findAll(); }
  define(name: string, dimensions: string[], metrics: string[]) {
    if (!name || !dimensions || !dimensions.length || !metrics || !metrics.length) throw new Error('参数缺失: name/dimensions/metrics');
    return this.repo.create({ name, dimensions, metrics });
  }
  generate(id: number) {
    const r = this.repo.findById(id);
    if (!r) throw new Error('报表不存在');
    const rows: ReportRow[] = r.dimensions.map((d) => {
      const m: Record<string, number> = {};
      r.metrics.forEach((k) => (m[k] = Math.floor(Math.random() * 1000)));
      return { reportId: id, dimension: d, metrics: m, generatedAt: Date.now() };
    });
    this.repo.addRows(rows);
    return rows;
  }
  data(id: number, dimension?: string) {
    if (!this.repo.findById(id)) throw new Error('报表不存在');
    return this.repo.findRows(id, dimension);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ReportService(new ReportRepository());

router.get('/api/reports', (ctx) => { ctx.body = service.list(); });
router.post('/api/reports', (ctx) => {
  try {
    const { name, dimensions, metrics } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.define(name, dimensions, metrics);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/reports/:id/generate', (ctx) => {
  try { ctx.body = service.generate(Number(ctx.params.id)); }
  catch (e) { const msg = (e as Error).message; ctx.status = msg === '报表不存在' ? 404 : 400; ctx.body = { message: msg }; }
});
router.get('/api/reports/:id/data', (ctx) => {
  try { ctx.body = service.data(Number(ctx.params.id), ctx.query.dimension as string | undefined); }
  catch (e) { ctx.status = 404; ctx.body = { message: (e as Error).message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[报表统计系统] running at http://localhost:' + PORT);
});
