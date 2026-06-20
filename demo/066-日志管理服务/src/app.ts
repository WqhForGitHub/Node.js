import Koa from 'koa';
import Router from 'koa-router';
import { createWriteStream } from 'fs';

/**
 * 日志管理服务
 * 结构化日志落盘
 * 结构化日志中间件 + 请求日志落盘
 */
const app = new Koa();
const router = new Router();
const accessLog = createWriteStream('./access.log', { flags: 'a' });

type LogLevel = 'info' | 'warn' | 'error';
function log(level: LogLevel, msg: string, meta: any = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  console.log(line);
  accessLog.write(line + '\n');
}

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    log('info', 'request', {
      method: ctx.method,
      path: ctx.path,
      status: ctx.status,
      ms: Date.now() - start,
    });
  } catch (e) {
    log('error', 'request failed', {
      method: ctx.method,
      path: ctx.path,
      err: (e as Error).message,
    });
    ctx.status = 500;
    ctx.body = { message: (e as Error).message };
  }
});

router.get('/', (ctx) => {
  ctx.body = { ok: true };
});
router.get('/warn', (ctx) => {
  log('warn', 'warn endpoint hit');
  ctx.body = { ok: true };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => log('info', '日志管理服务 started'));
