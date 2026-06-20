import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 日志分析平台
 * 日志接入、检索、聚合
 */
interface LogEntry { id: number; level: string; service: string; message: string; timestamp: number; }

// ---- Repository 层 ----
class LogRepository {
  private logs: LogEntry[] = [];
  add(log: LogEntry) { this.logs.push(log); }
  search(q: { level?: string; service?: string; keyword?: string; page: number; size: number }) {
    let list = this.logs;
    if (q.level) list = list.filter((l) => l.level === q.level);
    if (q.service) list = list.filter((l) => l.service === q.service);
    if (q.keyword) list = list.filter((l) => l.message.includes(q.keyword as string));
    const total = list.length;
    const start = (q.page - 1) * q.size;
    return { total, page: q.page, size: q.size, data: list.slice(start, start + q.size) };
  }
  aggregate() {
    const byService: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    this.logs.forEach((l) => {
      byService[l.service] = (byService[l.service] || 0) + 1;
      byLevel[l.level] = (byLevel[l.level] || 0) + 1;
    });
    return { byService, byLevel, total: this.logs.length };
  }
}
// ---- Service 层 ----
class LogService {
  constructor(private repo: LogRepository) {}
  ingest(level: string, service: string, message: string, timestamp?: number) {
    if (!level || !service || !message) throw new Error('参数缺失: level/service/message');
    const log: LogEntry = { id: Date.now() + Math.floor(Math.random() * 1000), level, service, message, timestamp: timestamp || Date.now() };
    this.repo.add(log);
    return log;
  }
  search(q: any) { return this.repo.search(q); }
  aggregate() { return this.repo.aggregate(); }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new LogService(new LogRepository());

router.post('/api/logs', (ctx) => {
  try {
    const { level, service: svc, message, timestamp } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.ingest(level, svc, message, timestamp);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/logs/aggregate', (ctx) => { ctx.body = service.aggregate(); });
router.get('/api/logs', (ctx) => {
  const { level, service: svc, keyword, page = '1', size = '10' } = ctx.query as any;
  ctx.body = service.search({ level, service: svc, keyword, page: Number(page), size: Number(size) });
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[日志分析平台] running at http://localhost:' + PORT);
});
