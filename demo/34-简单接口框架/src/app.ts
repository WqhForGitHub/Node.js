import Koa from 'koa';

/**
 * 简单接口框架
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 简单接口框架', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[简单接口框架] http://localhost:' + PORT));
