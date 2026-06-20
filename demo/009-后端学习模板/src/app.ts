import Koa from 'koa';

/**
 * 后端学习模板
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 后端学习模板', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[后端学习模板] http://localhost:' + PORT));
