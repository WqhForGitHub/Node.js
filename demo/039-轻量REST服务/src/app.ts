import Koa from 'koa';

/**
 * 轻量REST服务
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 轻量REST服务', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[轻量REST服务] http://localhost:' + PORT));
