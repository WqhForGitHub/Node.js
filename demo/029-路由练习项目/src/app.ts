import Koa from 'koa';

/**
 * 路由练习项目
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 路由练习项目', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[路由练习项目] http://localhost:' + PORT));
