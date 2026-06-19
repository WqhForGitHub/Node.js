import Koa from 'koa';
import Router from 'koa-router';

/**
 * 高并发服务架构
 * 高并发指标监控
 * 监控指标采集: 请求计数 / 延迟直方图 / 健康状态
 */
const app = new Koa();
const router = new Router();

const metrics = {
  requests: 0,
  errors: 0,
  totalMs: 0,
  latency: [] as number[],
};

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
  } catch (e) {
    metrics.errors++;
    ctx.status = 500;
    ctx.body = { message: (e as Error).message };
  }
  const ms = Date.now() - start;
  metrics.requests++;
  metrics.totalMs += ms;
  metrics.latency.push(ms);
  if (metrics.latency.length > 100) metrics.latency.shift();
});

router.get('/', (ctx) => {
  ctx.body = { ok: true };
});
router.get('/metrics', (ctx) => {
  const lat = metrics.latency;
  const avg = lat.length ? (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(2) : 0;
  ctx.body = {
    requests: metrics.requests,
    errors: metrics.errors,
    avgLatencyMs: Number(avg),
    uptimeSec: process.uptime().toFixed(0),
  };
});
router.get('/health', (ctx) => {
  ctx.body = { status: 'up' };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[高并发服务架构] running'));
