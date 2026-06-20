import Koa from 'koa';

/**
 * 接口练手项目
 * Koa + TypeScript 基础示例
 */
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = { message: 'Hello from 接口练手项目', time: new Date().toISOString() };
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[接口练手项目] http://localhost:' + PORT));
