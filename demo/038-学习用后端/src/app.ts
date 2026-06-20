import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 学习用后端
 * Koa + TypeScript 基础示例
 */
const app = new Koa();
const router = new Router();

app.use(bodyParser());

// 健康检查
router.get('/health', (ctx) => {
  ctx.body = { status: 'ok', service: '学习用后端' };
});

// GET /api/hello - 示例接口
router.get('/api/hello', (ctx) => {
  ctx.body = { message: '示例接口', path: '/api/hello' };
});

// GET /api/list - 列表接口
router.get('/api/list', (ctx) => {
  ctx.body = { message: '列表接口', path: '/api/list' };
});

// POST /api/create - 创建接口
router.post('/api/create', (ctx) => {
  ctx.body = { message: '创建接口', path: '/api/create' };
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[学习用后端] running at http://localhost:' + PORT);
});
