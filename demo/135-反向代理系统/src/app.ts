import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 反向代理系统
 * 注册上游 + 反向代理中间件，mock 请求转发模拟
 */

// ---- 类型定义 ----
interface Upstream {
  name: string;
  url: string; // 上游地址，如 http://backend:8080
  health: 'up' | 'down';
  createdAt: number;
}

// ---- Repository 层 ----
class UpstreamRepository {
  private upstreams: Map<string, Upstream> = new Map();

  upsert(u: Upstream): void {
    this.upstreams.set(u.name, u);
  }

  findByName(name: string): Upstream | undefined {
    return this.upstreams.get(name);
  }

  findAll(): Upstream[] {
    return Array.from(this.upstreams.values());
  }

  remove(name: string): boolean {
    return this.upstreams.delete(name);
  }
}

// ---- Service 层 ----
class ProxyService {
  constructor(private repo: UpstreamRepository) {}

  register(data: any): Upstream {
    if (!data.name) throw { status: 400, message: 'name required' };
    if (!data.url) throw { status: 400, message: 'url required' };
    const up: Upstream = {
      name: data.name,
      url: data.url.replace(/\/$/, ''),
      health: data.health || 'up',
      createdAt: Date.now(),
    };
    this.repo.upsert(up);
    return up;
  }

  list(): Upstream[] {
    return this.repo.findAll();
  }

  remove(name: string): void {
    if (!this.repo.remove(name)) throw { status: 404, message: 'upstream not found' };
  }

  // mock 转发：拼 URL，返回 {proxied, upstream, forwardedPath, method, body}
  forward(upstreamName: string, forwardedPath: string, method: string, body: any): any {
    const up = this.repo.findByName(upstreamName);
    if (!up) throw { status: 404, message: 'upstream not found' };
    if (up.health === 'down') throw { status: 503, message: 'upstream down' };
    const path = forwardedPath.startsWith('/') ? forwardedPath : '/' + forwardedPath;
    const url = up.url + path;
    return {
      proxied: true,
      upstream: up.name,
      upstreamUrl: up.url,
      url,
      forwardedPath: path,
      method: method.toUpperCase(),
      body,
    };
  }
}

// ---- 装配 ----
const app = new Koa();
const apiRouter = new Router();
const proxyRouter = new Router();
app.use(bodyParser());
const service = new ProxyService(new UpstreamRepository());

// 管理接口
apiRouter.post('/api/upstreams', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.register((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

apiRouter.get('/api/upstreams', (ctx) => {
  ctx.body = service.list();
});

apiRouter.delete('/api/upstreams/:name', (ctx) => {
  try {
    service.remove(ctx.params.name);
    ctx.status = 204;
    ctx.body = null;
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// 代理转发：ALL /proxy/:upstream/*
proxyRouter.all('/proxy/:upstream/(.*)', (ctx) => {
  try {
    const subPath = ctx.params[1] || '';
    ctx.body = service.forward(ctx.params.upstream, '/' + subPath, ctx.method, ctx.request.body);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(apiRouter.routes()).use(apiRouter.allowedMethods());
app.use(proxyRouter.routes()).use(proxyRouter.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[反向代理系统] running at http://localhost:' + PORT);
});
