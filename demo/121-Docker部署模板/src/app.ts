import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * Docker部署模板
 * 提供健康检查与容器环境信息接口，配合 Dockerfile 与 docker-compose.yml 使用
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// 启动时间，用于 /api/info 输出 uptime
const startedAt = Date.now();

// GET /health - 健康检查，容器探针使用
router.get('/health', (ctx) => {
  ctx.body = { status: 'ok', uptime: Date.now() - startedAt };
});

// GET /api/info - 返回容器环境信息
router.get('/api/info', (ctx) => {
  ctx.body = {
    service: 'Docker部署模板',
    version: '1.0.0',
    hostname: require('os').hostname(),
    platform: process.platform,
    nodeVersion: process.version,
    port: process.env.PORT || 3000,
    uptime: Date.now() - startedAt,
    memory: process.memoryUsage().rss,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '3000',
    },
  };
});

// GET /api/echo - 简单回显，便于容器内测试
router.get('/api/echo', (ctx) => {
  ctx.body = { echo: ctx.query };
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[Docker部署模板] running at http://localhost:' + PORT);
});
