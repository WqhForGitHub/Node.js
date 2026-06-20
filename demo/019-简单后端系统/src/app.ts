import Koa from 'koa';

/**
 * 简单后端系统
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 简单后端系统', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[简单后端系统] http://localhost:' + PORT));
