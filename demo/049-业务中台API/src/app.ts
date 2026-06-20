import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 业务中台API
 * 业务中台 API 网关
 * 统一 API 规范: 响应包络 / 参数校验 / 版本前缀
 */
const app = new Koa();
const router = new Router({ prefix: '/api/v1' });
app.use(bodyParser());

function envelope(data: any, code = 0, message = 'success') {
  return { code, message, data, timestamp: Date.now() };
}

function validate(body: any, fields: string[]) {
  return fields.filter((f) => body[f] === undefined);
}

router.get('/ping', (ctx) => {
  ctx.body = envelope({ pong: true });
});
router.post('/items', (ctx) => {
  const body = (ctx.request.body || {}) as { name?: string };
  const missing = validate(body, ['name']);
  if (missing.length) {
    ctx.status = 400;
    ctx.body = envelope(null, 400, '缺少字段: ' + missing.join(','));
    return;
  }
  ctx.status = 201;
  ctx.body = envelope({ id: Date.now(), name: body.name });
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[业务中台API] running'));
