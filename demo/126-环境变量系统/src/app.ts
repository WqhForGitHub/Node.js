import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 环境变量系统
 * 环境变量 CRUD、按 scope/keyword 过滤、导出 .env/json、批量导入
 */
type Scope = 'project' | 'service';
interface EnvVar {
  id: number;
  key: string;
  value: string;
  scope: Scope;
  updatedAt: number;
}
// ---- Repository 层 ----
class EnvRepository {
  private vars: EnvVar[] = [];
  private seq = 1;
  create(key: string, value: string, scope: Scope) {
    if (this.vars.find((v) => v.key === key && v.scope === scope)) throw new Error('变量已存在');
    const v: EnvVar = { id: this.seq++, key, value, scope, updatedAt: Date.now() };
    this.vars.push(v);
    return v;
  }
  find(scope?: Scope, keyword?: string) {
    return this.vars.filter((v) =>
      (!scope || v.scope === scope) &&
      (!keyword || v.key.toLowerCase().includes(keyword.toLowerCase())));
  }
  findById(id: number) { return this.vars.find((v) => v.id === id); }
  update(id: number, patch: Partial<EnvVar>) {
    const v = this.findById(id);
    if (!v) return undefined;
    Object.assign(v, patch, { updatedAt: Date.now() });
    return v;
  }
  delete(id: number) {
    const idx = this.vars.findIndex((v) => v.id === id);
    if (idx < 0) return false;
    this.vars.splice(idx, 1);
    return true;
  }
  bulkCreate(items: { key: string; value: string }[], scope: Scope) {
    const created: EnvVar[] = [];
    for (const it of items) {
      if (!this.vars.find((v) => v.key === it.key && v.scope === scope)) {
        const v: EnvVar = { id: this.seq++, key: it.key, value: it.value, scope, updatedAt: Date.now() };
        this.vars.push(v);
        created.push(v);
      }
    }
    return created;
  }
}
// ---- Service 层 ----
class EnvService {
  constructor(private repo: EnvRepository) {}
  create(body: any) {
    if (!body || !body.key || body.value === undefined || !body.scope) throw new Error('参数缺失: key/value/scope');
    if (!['project', 'service'].includes(body.scope)) throw new Error('scope 非法');
    return this.repo.create(body.key, String(body.value), body.scope);
  }
  list(scope?: Scope, keyword?: string) { return this.repo.find(scope, keyword); }
  update(id: number, body: any) {
    if (!body) throw new Error('参数缺失');
    const v = this.repo.update(id, {
      ...(body.key !== undefined ? { key: body.key } : {}),
      ...(body.value !== undefined ? { value: String(body.value) } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
    });
    if (!v) throw new Error('not found');
    return v;
  }
  delete(id: number) {
    if (!this.repo.delete(id)) throw new Error('not found');
    return { deleted: true };
  }
  export(scope: Scope | undefined, format: 'env' | 'json') {
    const list = this.repo.find(scope);
    if (format === 'json') return { contentType: 'application/json', body: JSON.stringify(list, null, 2) };
    const text = list.map((v) => `${v.key}=${v.value}`).join('\n');
    return { contentType: 'text/plain', body: text };
  }
  import(body: any) {
    if (!body || !body.scope || typeof body.content !== 'string') throw new Error('参数缺失: scope/content');
    if (!['project', 'service'].includes(body.scope)) throw new Error('scope 非法');
    // 解析 .env 文本：每行 KEY=VALUE
    const items = body.content
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l && !l.startsWith('#'))
      .map((l: string) => {
        const idx = l.indexOf('=');
        return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
      })
      .filter((it: any) => it.key);
    return this.repo.bulkCreate(items, body.scope);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new EnvService(new EnvRepository());

// 创建变量
router.post('/api/envs', (ctx) => {
  try { ctx.status = 201; ctx.body = service.create(ctx.request.body); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// 列表（按 scope/keyword 过滤）
router.get('/api/envs', (ctx) => {
  ctx.body = service.list(ctx.query.scope as Scope | undefined, ctx.query.keyword as string | undefined);
});
// 更新
router.put('/api/envs/:id', (ctx) => {
  try { ctx.body = service.update(Number(ctx.params.id), ctx.request.body); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});
// 删除
router.delete('/api/envs/:id', (ctx) => {
  try { ctx.body = service.delete(Number(ctx.params.id)); }
  catch (e: any) { ctx.status = e.message === 'not found' ? 404 : 400; ctx.body = { message: e.message }; }
});
// 导出
router.get('/api/envs/export', (ctx) => {
  const format = (ctx.query.format as 'env' | 'json') || 'env';
  const result = service.export(ctx.query.scope as Scope | undefined, format);
  ctx.type = result.contentType;
  ctx.body = result.body;
});
// 批量导入 .env 文本
router.post('/api/envs/import', (ctx) => {
  try { ctx.status = 201; ctx.body = service.import(ctx.request.body); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[环境变量系统] running at http://localhost:' + PORT));
