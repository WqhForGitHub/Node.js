import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 多租户系统
 * 多租户数据隔离
 * 多租户: 按 tenantId 隔离数据
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// tenant -> data
const tenants = new Map<string, any[]>();

function ensureTenant(id: string) {
  if (!tenants.has(id)) tenants.set(id, []);
  return tenants.get(id)!;
}

// 租户解析中间件
app.use(async (ctx, next) => {
  const tenantId = (ctx.header['x-tenant-id'] as string) || 'default';
  ctx.state.tenantId = tenantId;
  ctx.state.store = ensureTenant(tenantId);
  await next();
});

router.get('/items', (ctx) => {
  ctx.body = ctx.state.store;
});
router.post('/items', (ctx) => {
  const item = { id: ctx.state.store.length + 1, ...(ctx.request.body || {}) };
  ctx.state.store.push(item);
  ctx.status = 201;
  ctx.body = item;
});
router.get('/tenants', (ctx) => {
  ctx.body = [...tenants.keys()].map((id) => ({ id, count: tenants.get(id)!.length }));
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[多租户系统] running'));
