import Koa from 'koa';
import Router from 'koa-router';

/**
 * 异常处理中心
 * 统一异常处理中心
 * 统一异常处理: 业务错误码 + 全局兜底
 */
const app = new Koa();
const router = new Router();

class BizError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

function ok(ctx: Koa.Context, data: any) {
  ctx.body = { code: 0, message: 'success', data };
}
function fail(ctx: Koa.Context, code: number, message: string) {
  ctx.body = { code, message, data: null };
}

app.use(async (ctx, next) => {
  try {
    await next();
    ok(ctx, ctx.body);
    if (ctx.body && ctx.body.code === 0) {
    }
  } catch (e) {
    if (e instanceof BizError) {
      ctx.status = 200;
      ctx.body = { code: e.code, message: e.message, data: null };
    } else {
      ctx.status = 500;
      ctx.body = { code: 500, message: '服务器内部错误', data: null };
      console.error(e);
    }
  }
});

router.get('/ok', (ctx) => {
  ctx.body = { hello: 'world' };
});
router.get('/biz', () => {
  throw new BizError(10001, '业务异常示例');
});
router.get('/crash', () => {
  throw new Error('unexpected');
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[异常处理中心] running'));
