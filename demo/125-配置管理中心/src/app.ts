import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 配置管理中心
 * 应用注册、配置增改查、环境隔离、版本历史、发布
 */
type Env = 'dev' | 'staging' | 'prod';
interface ConfigVersion {
  value: string;
  updatedAt: number;
}
interface Config {
  id: number;
  app: string;
  key: string;
  value: string;
  env: Env;
  history: ConfigVersion[];
  updatedAt: number;
}
interface AppInfo {
  name: string;
  createdAt: number;
}
interface PublishRecord {
  app: string;
  env: Env;
  count: number;
  publishedAt: number;
}
// ---- Repository 层 ----
class ConfigRepository {
  private apps: AppInfo[] = [];
  private configs: Config[] = [];
  private publishes: PublishRecord[] = [];
  private seq = 1;
  registerApp(name: string) {
    if (this.apps.find((a) => a.name === name)) throw new Error('应用已存在');
    const a = { name, createdAt: Date.now() };
    this.apps.push(a);
    return a;
  }
  findApp(name: string) {
    return this.apps.find((a) => a.name === name);
  }
  addConfig(app: string, key: string, value: string, env: Env) {
    if (this.configs.find((c) => c.app === app && c.key === key && c.env === env)) {
      throw new Error('配置已存在');
    }
    const c: Config = {
      id: this.seq++,
      app,
      key,
      value,
      env,
      history: [{ value, updatedAt: Date.now() }],
      updatedAt: Date.now(),
    };
    this.configs.push(c);
    return c;
  }
  findByApp(app: string, env?: Env) {
    return this.configs.filter((c) => c.app === app && (!env || c.env === env));
  }
  findById(id: number) {
    return this.configs.find((c) => c.id === id);
  }
  update(id: number, value: string) {
    const c = this.findById(id);
    if (!c) return undefined;
    c.history.push({ value: c.value, updatedAt: c.updatedAt });
    c.value = value;
    c.updatedAt = Date.now();
    return c;
  }
  publish(app: string, env: Env) {
    const list = this.findByApp(app, env);
    const rec: PublishRecord = { app, env, count: list.length, publishedAt: Date.now() };
    this.publishes.push(rec);
    return rec;
  }
}
// ---- Service 层 ----
class ConfigService {
  constructor(private repo: ConfigRepository) {}
  registerApp(name: string) {
    return this.repo.registerApp(name);
  }
  addConfig(app: string, body: any) {
    if (!body || !body.key || body.value === undefined || !body.env)
      throw new Error('参数缺失: key/value/env');
    if (!['dev', 'staging', 'prod'].includes(body.env)) throw new Error('env 非法');
    if (!this.repo.findApp(app)) throw new Error('应用不存在');
    return this.repo.addConfig(app, body.key, String(body.value), body.env);
  }
  listConfigs(app: string, env?: Env) {
    if (!this.repo.findApp(app)) throw new Error('应用不存在');
    return this.repo.findByApp(app, env);
  }
  update(id: number, body: any) {
    if (!body || body.value === undefined) throw new Error('参数缺失: value');
    const c = this.repo.update(id, String(body.value));
    if (!c) throw new Error('not found');
    return c;
  }
  history(id: number) {
    const c = this.repo.findById(id);
    if (!c) throw new Error('not found');
    return c.history;
  }
  publish(app: string, body: any) {
    if (!body || !body.env) throw new Error('参数缺失: env');
    if (!['dev', 'staging', 'prod'].includes(body.env)) throw new Error('env 非法');
    if (!this.repo.findApp(app)) throw new Error('应用不存在');
    return this.repo.publish(app, body.env);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ConfigService(new ConfigRepository());

// 注册应用
router.post('/api/apps', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.registerApp((ctx.request.body as any)?.name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 添加配置
router.post('/api/apps/:app/configs', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.addConfig(ctx.params.app, ctx.request.body);
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 查询配置（按 env 过滤）
router.get('/api/apps/:app/configs', (ctx) => {
  try {
    ctx.body = service.listConfigs(ctx.params.app, ctx.query.env as Env | undefined);
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 更新配置
router.put('/api/configs/:id', (ctx) => {
  try {
    ctx.body = service.update(Number(ctx.params.id), ctx.request.body);
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 配置变更历史
router.get('/api/configs/:id/history', (ctx) => {
  try {
    ctx.body = service.history(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// 发布配置到某环境
router.post('/api/apps/:app/publish', (ctx) => {
  try {
    ctx.body = service.publish(ctx.params.app, ctx.request.body);
  } catch (e: any) {
    ctx.status = e.message === 'not found' ? 404 : 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[配置管理中心] running at http://localhost:' + PORT));
