import Koa from 'koa';
import Router from 'koa-router';

/**
 * 统一服务治理系统
 * 服务治理: 注册/发现/配置
 * 配置中心: 环境变量 + 运行时配置 + 热更新
 */
const app = new Koa();
const router = new Router();

const configStore: Record<string, any> = {
  app: { name: '统一服务治理系统', version: '1.0.0' },
  db: { host: 'localhost', port: 3306 },
  featureFlags: { newUserUI: true, betaApi: false },
};

function getConfig() {
  return configStore;
}

router.get('/config', (ctx) => {
  ctx.body = getConfig();
});
router.get('/config/:namespace', (ctx) => {
  const ns = configStore[ctx.params.namespace];
  if (!ns) {
    ctx.status = 404;
    ctx.body = { message: 'namespace not found' };
    return;
  }
  ctx.body = ns;
});
router.put('/config/:namespace', (ctx) => {
  const ns = ctx.params.namespace;
  configStore[ns] = { ...(configStore[ns] || {}), ...(ctx.request.body || {}) };
  ctx.body = configStore[ns];
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[统一服务治理系统] running'));
