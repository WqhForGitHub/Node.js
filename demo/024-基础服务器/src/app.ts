import Koa from 'koa';

/**
 * 基础服务器
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 基础服务器', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[基础服务器] http://localhost:' + PORT));
