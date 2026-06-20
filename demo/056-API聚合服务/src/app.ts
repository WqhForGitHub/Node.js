import Koa from 'koa';
import Router from 'koa-router';

/**
 * API聚合服务
 * API 聚合多个下游
 * 模拟网关: 路由转发 / 聚合多个下游服务
 */
const app = new Koa();
const router = new Router();

const downstream: Record<string, { baseURL: string; healthy: boolean }> = {
  user: { baseURL: 'http://user-svc:3001', healthy: true },
  order: { baseURL: 'http://order-svc:3002', healthy: true },
  product: { baseURL: 'http://product-svc:3003', healthy: true },
};

// 简单服务发现
router.get('/gateway/services', (ctx) => {
  ctx.body = downstream;
});

// 路由转发映射
const routeMap = {
  '/api/users': 'user',
  '/api/orders': 'order',
  '/api/products': 'product',
};

router.all('/api/(.*)', async (ctx) => {
  const seg = ctx.path.replace('/api/', '').split('/')[0];
  const svc = Object.entries(routeMap).find(([p]) => p.endsWith('/' + seg));
  const target = svc ? downstream[svc[1]] : null;
  if (!target) {
    ctx.status = 404;
    ctx.body = { message: 'no route matched' };
    return;
  }
  if (!target.healthy) {
    ctx.status = 503;
    ctx.body = { message: 'service unavailable' };
    return;
  }
  // 模拟转发
  ctx.body = { forwarded: true, target: target.baseURL, path: ctx.path, method: ctx.method };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[API聚合服务] running'));
