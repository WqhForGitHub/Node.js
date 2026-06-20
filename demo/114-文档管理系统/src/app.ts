import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 文档管理系统
 * 文档版本控制，更新自动保存历史版本，支持版本回溯与回滚
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface DocVersion {
  version: number;
  content: string;
  updatedAt: string;
}
interface Doc {
  id: number;
  title: string;
  content: string;
  currentVersion: number;
  versions: DocVersion[];
}

// 仓储层
class DocRepository {
  private docs: Doc[] = [];
  private seq = 0;
  create(data: any): Doc {
    const d: Doc = {
      id: ++this.seq,
      title: data.title,
      content: data.content || '',
      currentVersion: 1,
      versions: [{ version: 1, content: data.content || '', updatedAt: new Date().toISOString() }],
    };
    this.docs.push(d);
    return d;
  }
  findById(id: number) { return this.docs.find((d) => d.id === id); }
  // 更新文档：自动把当前内容存为历史版本
  update(id: number, data: any): Doc | null {
    const d = this.findById(id);
    if (!d) return null;
    // 保存旧版本
    d.versions.push({ version: d.currentVersion + 1, content: data.content ?? d.content, updatedAt: new Date().toISOString() });
    if (data.title !== undefined) d.title = data.title;
    if (data.content !== undefined) d.content = data.content;
    d.currentVersion++;
    return d;
  }
  findVersion(id: number, version: number) {
    const d = this.findById(id);
    if (!d) return null;
    return d.versions.find((v) => v.version === version) || null;
  }
  rollback(id: number, version: number): Doc | null {
    const d = this.findById(id);
    if (!d) return null;
    const v = d.versions.find((x) => x.version === version);
    if (!v) return null;
    // 把回滚后的内容作为新版本追加
    d.versions.push({ version: d.currentVersion + 1, content: v.content, updatedAt: new Date().toISOString() });
    d.content = v.content;
    d.currentVersion++;
    return d;
  }
}

// 服务层
class DocService {
  constructor(private repo: DocRepository) {}
  create(data: any) {
    if (!data.title) throw new Error('title 必填');
    return this.repo.create(data);
  }
  update(id: number, data: any) {
    if (data.content === undefined && data.title === undefined) throw new Error('无更新字段');
    return this.repo.update(id, data);
  }
  get(id: number) { return this.repo.findById(id); }
  versions(id: number) { const d = this.repo.findById(id); return d ? d.versions : null; }
  getVersion(id: number, version: number) { return this.repo.findVersion(id, version); }
  rollback(id: number, version: number) { return this.repo.rollback(id, version); }
}

const repo = new DocRepository();
const service = new DocService(repo);

// POST /api/docs - 创建文档
router.post('/api/docs', (ctx) => {
  try { ctx.status = 201; ctx.body = service.create(ctx.request.body || {}); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// PUT /api/docs/:id - 更新（自动保存旧版本）
router.put('/api/docs/:id', (ctx) => {
  try {
    const d = service.update(Number(ctx.params.id), ctx.request.body || {});
    if (!d) { ctx.status = 404; ctx.body = { message: '文档不存在' }; return; }
    ctx.body = d;
  } catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// GET /api/docs/:id - 当前版本
router.get('/api/docs/:id', (ctx) => {
  const d = service.get(Number(ctx.params.id));
  if (!d) { ctx.status = 404; ctx.body = { message: '文档不存在' }; return; }
  ctx.body = d;
});
// GET /api/docs/:id/versions - 版本历史
router.get('/api/docs/:id/versions', (ctx) => {
  const v = service.versions(Number(ctx.params.id));
  if (v === null) { ctx.status = 404; ctx.body = { message: '文档不存在' }; return; }
  ctx.body = v;
});
// GET /api/docs/:id/versions/:version - 回溯某版本
router.get('/api/docs/:id/versions/:version', (ctx) => {
  const v = service.getVersion(Number(ctx.params.id), Number(ctx.params.version));
  if (!v) { ctx.status = 404; ctx.body = { message: '版本不存在' }; return; }
  ctx.body = v;
});
// POST /api/docs/:id/rollback/:version - 回滚到指定版本
router.post('/api/docs/:id/rollback/:version', (ctx) => {
  const d = service.rollback(Number(ctx.params.id), Number(ctx.params.version));
  if (!d) { ctx.status = 404; ctx.body = { message: '文档或版本不存在' }; return; }
  ctx.body = d;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[文档管理系统] running at http://localhost:' + PORT));
