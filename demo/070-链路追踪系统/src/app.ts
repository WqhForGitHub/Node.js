import Koa from 'koa';
import Router from 'koa-router';
import crypto from 'crypto';

/**
 * 链路追踪系统
 * traceId 链路追踪
 * 链路追踪: 生成 traceId / spanId，贯穿请求
 */
const app = new Koa();
const router = new Router();

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

app.use(async (ctx, next) => {
  const traceId = (ctx.header['x-trace-id'] as string) || genId();
  const spanId = genId();
  ctx.state.trace = { traceId, spanId };
  ctx.set('x-trace-id', traceId);
  console.log(
    JSON.stringify({ traceId, spanId, method: ctx.method, path: ctx.path, ts: Date.now() }),
  );
  await next();
  console.log(
    JSON.stringify({ traceId, spanId, status: ctx.status, ts: Date.now(), phase: 'end' }),
  );
});

router.get('/', (ctx) => {
  ctx.body = { trace: ctx.state.trace, ok: true };
});
router.get('/chain', (ctx) => {
  // 模拟调用下游，传递 traceId
  ctx.body = { trace: ctx.state.trace, downstream: 'would-forward-trace-id' };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[链路追踪系统] running'));
