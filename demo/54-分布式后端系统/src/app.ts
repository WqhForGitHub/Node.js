import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 分布式后端系统
 * 分布式服务注册中心
 * 服务注册与发现: 服务注册 / 心跳 / 发现
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

const registry = new Map<string, { name: string; host: string; port: number; lastBeat: number }>();

router.post('/register', (ctx) => {
  const { name, host, port } = (ctx.request.body || {}) as {
    name: string;
    host: string;
    port: number;
  };
  const id = name + '@' + host + ':' + port;
  registry.set(id, { name, host, port, lastBeat: Date.now() });
  ctx.body = { registered: true, id };
});
router.post('/heartbeat', (ctx) => {
  const { name, host, port } = (ctx.request.body || {}) as {
    name: string;
    host: string;
    port: number;
  };
  const id = name + '@' + host + ':' + port;
  const inst = registry.get(id);
  if (!inst) {
    ctx.status = 404;
    ctx.body = { message: '未注册' };
    return;
  }
  inst.lastBeat = Date.now();
  ctx.body = { ok: true };
});
router.get('/services/:name', (ctx) => {
  const list = [...registry.values()].filter(
    (i) => i.name === ctx.params.name && Date.now() - i.lastBeat < 30000,
  );
  ctx.body = list;
});
router.get('/services', (ctx) => {
  ctx.body = [...registry.values()];
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[分布式后端系统] running'));
