import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * API网关服务
 * 网关路由表注册 + 路径匹配 + mock 转发
 */

// ---- 类型定义 ----
interface GatewayRoute {
  id: string;
  path: string; // 匹配前缀，如 /users
  target: string; // 上游地址，如 http://user-service:8080
  methods: string[]; // 允许的方法
  stripPrefix: boolean; // 是否剥离前缀
  createdAt: number;
}

// ---- Repository 层 ----
class RouteRepository {
  private routes: GatewayRoute[] = [];

  insert(r: GatewayRoute): void {
    this.routes.push(r);
  }

  findById(id: string): GatewayRoute | undefined {
    return this.routes.find((r) => r.id === id);
  }

  findAll(): GatewayRoute[] {
    return this.routes;
  }

  update(id: string, data: Partial<GatewayRoute>): GatewayRoute {
    const r = this.findById(id);
    if (!r) throw { status: 404, message: 'route not found' };
    Object.assign(r, data);
    return r;
  }

  remove(id: string): boolean {
    const idx = this.routes.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    this.routes.splice(idx, 1);
    return true;
  }

  // 路径匹配：找到第一个匹配的路由（按注册顺序）
  match(method: string, path: string): GatewayRoute | undefined {
    return this.routes.find((r) => {
      const pathMatch = path === r.path || path.startsWith(r.path + '/') || path.startsWith(r.path);
      const methodMatch = r.methods.includes(method.toUpperCase());
      return pathMatch && methodMatch;
    });
  }
}

// ---- Service 层 ----
class GatewayService {
  constructor(private repo: RouteRepository) {}

  create(data: any): GatewayRoute {
    if (!data.path) throw { status: 400, message: 'path required' };
    if (!data.target) throw { status: 400, message: 'target required' };
    const route: GatewayRoute = {
      id: crypto.randomBytes(8).toString('hex'),
      path: data.path,
      target: data.target,
      methods: data.methods || ['GET', 'POST', 'PUT', 'DELETE'],
      stripPrefix: data.stripPrefix !== undefined ? !!data.stripPrefix : false,
      createdAt: Date.now(),
    };
    this.repo.insert(route);
    return route;
  }

  list(): GatewayRoute[] {
    return this.repo.findAll();
  }

  update(id: string, data: any): GatewayRoute {
    if (data.methods && !Array.isArray(data.methods)) throw { status: 400, message: 'methods must be array' };
    return this.repo.update(id, data);
  }

  remove(id: string): void {
    if (!this.repo.remove(id)) throw { status: 404, message: 'route not found' };
  }

  // mock 转发：根据路径匹配路由表，返回 {proxied: true, target, path, method}
  forward(method: string, fullPath: string, body: any): any {
    const route = this.repo.match(method, fullPath);
    if (!route) throw { status: 404, message: 'no matching route' };
    let forwardedPath = fullPath;
    if (route.stripPrefix) {
      forwardedPath = fullPath.slice(route.path.length) || '/';
    }
    return {
      proxied: true,
      target: route.target,
      path: forwardedPath,
      method: method.toUpperCase(),
      routeId: route.id,
      body,
    };
  }
}

// ---- 装配 ----
const app = new Koa();
const apiRouter = new Router(); // 管理 API
const gatewayRouter = new Router(); // 网关转发
app.use(bodyParser());
const service = new GatewayService(new RouteRepository());

// 管理接口
apiRouter.post('/api/routes', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

apiRouter.get('/api/routes', (ctx) => {
  ctx.body = service.list();
});

apiRouter.put('/api/routes/:id', (ctx) => {
  try {
    ctx.body = service.update(ctx.params.id, ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

apiRouter.delete('/api/routes/:id', (ctx) => {
  try {
    service.remove(ctx.params.id);
    ctx.status = 204;
    ctx.body = null;
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// 网关转发：ALL /gateway/*
gatewayRouter.all('/gateway/(.*)', (ctx) => {
  try {
    const subPath = '/' + (ctx.params[0] || '');
    ctx.body = service.forward(ctx.method, subPath, ctx.request.body);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(apiRouter.routes()).use(apiRouter.allowedMethods());
app.use(gatewayRouter.routes()).use(gatewayRouter.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[API网关服务] running at http://localhost:' + PORT);
});
