import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 性能监控平台
 * 性能指标采集、时序查询、时间窗口聚合、指标名列表、告警规则
 */
interface Metric {
  id: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}
interface AlertRule {
  id: number;
  name: string;
  metric: string;
  threshold: number;
  createdAt: number;
}
// ---- Repository 层 ----
class MetricRepository {
  private metrics: Metric[] = [];
  private alerts: AlertRule[] = [];
  private seqM = 1;
  private seqA = 1;
  add(name: string, value: number, tags: Record<string, string>, timestamp: number) {
    const m: Metric = {
      id: this.seqM++,
      name,
      value,
      tags: tags || {},
      timestamp: timestamp || Date.now(),
    };
    this.metrics.push(m);
    return m;
  }
  query(name?: string, tags?: Record<string, string>, from?: number, to?: number) {
    return this.metrics.filter(
      (m) =>
        (!name || m.name === name) &&
        (!from || m.timestamp >= from!) &&
        (!to || m.timestamp <= to!) &&
        (!tags || Object.entries(tags).every(([k, v]) => m.tags[k] === v)),
    );
  }
  aggregate(name: string, interval: number, from?: number, to?: number) {
    const list = this.query(name, undefined, from, to);
    const buckets: Record<number, number[]> = {};
    for (const m of list) {
      const key = Math.floor(m.timestamp / interval) * interval;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(m.value);
    }
    return Object.entries(buckets)
      .map(([t, vals]) => ({
        bucket: Number(t),
        count: vals.length,
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        max: Math.max(...vals),
        min: Math.min(...vals),
      }))
      .sort((a, b) => a.bucket - b.bucket);
  }
  names() {
    return Array.from(new Set(this.metrics.map((m) => m.name)));
  }
  addAlert(name: string, metric: string, threshold: number) {
    const a: AlertRule = { id: this.seqA++, name, metric, threshold, createdAt: Date.now() };
    this.alerts.push(a);
    return a;
  }
}
// ---- Service 层 ----
class MetricService {
  constructor(private repo: MetricRepository) {}
  report(body: any) {
    if (!body || !body.name || typeof body.value !== 'number')
      throw new Error('参数缺失: name/value');
    return this.repo.add(body.name, body.value, body.tags || {}, body.timestamp);
  }
  query(q: any) {
    let tags: Record<string, string> | undefined;
    if (q.tags) {
      try {
        tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags;
      } catch {
        tags = undefined;
      }
    }
    return this.repo.query(
      q.name,
      tags,
      q.from ? Number(q.from) : undefined,
      q.to ? Number(q.to) : undefined,
    );
  }
  aggregate(q: any) {
    if (!q.name) throw new Error('参数缺失: name');
    const interval = Number(q.interval) || 60000;
    return this.repo.aggregate(
      q.name,
      interval,
      q.from ? Number(q.from) : undefined,
      q.to ? Number(q.to) : undefined,
    );
  }
  names() {
    return this.repo.names();
  }
  addAlert(body: any) {
    if (!body || !body.name || !body.metric || typeof body.threshold !== 'number')
      throw new Error('参数缺失: name/metric/threshold');
    return this.repo.addAlert(body.name, body.metric, body.threshold);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new MetricService(new MetricRepository());

// 上报指标
router.post('/api/metrics', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.report(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 时序查询
router.get('/api/metrics', (ctx) => {
  ctx.body = service.query(ctx.query);
});
// 时间窗口聚合
router.get('/api/metrics/aggregate', (ctx) => {
  try {
    ctx.body = service.aggregate(ctx.query);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 指标名列表
router.get('/api/metrics/names', (ctx) => {
  ctx.body = service.names();
});
// 告警规则
router.post('/api/alerts', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.addAlert(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[性能监控平台] running at http://localhost:' + PORT));
