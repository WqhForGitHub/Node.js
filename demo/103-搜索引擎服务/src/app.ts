import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 搜索引擎服务
 * 索引管理、搜索
 */
interface Doc { id: number; [key: string]: any; }
interface Index { name: string; docs: Doc[]; }

// ---- Repository 层 ----
class SearchRepository {
  private indexes: Map<string, Index> = new Map();
  create(name: string, docs: Doc[]) {
    if (this.indexes.has(name)) throw new Error('索引已存在');
    const idx: Index = { name, docs };
    this.indexes.set(name, idx);
    return idx;
  }
  addDocs(name: string, docs: Doc[]) {
    const idx = this.indexes.get(name);
    if (!idx) throw new Error('索引不存在');
    idx.docs.push(...docs);
    return idx;
  }
  search(name: string, q: string) {
    const idx = this.indexes.get(name);
    if (!idx) throw new Error('索引不存在');
    const lower = q.toLowerCase();
    const hits = idx.docs.map((d) => {
      const highlight: Record<string, string> = {};
      let matched = false;
      Object.keys(d).forEach((k) => {
        if (k === 'id') return;
        const v = String(d[k]);
        if (v.toLowerCase().includes(lower)) {
          matched = true;
          highlight[k] = v.replace(new RegExp(q, 'gi'), (m) => `<em>${m}</em>`);
        }
      });
      return matched ? { doc: d, highlight } : null;
    }).filter(Boolean) as { doc: Doc; highlight: Record<string, string> }[];
    return { total: hits.length, hits };
  }
}
// ---- Service 层 ----
class SearchService {
  constructor(private repo: SearchRepository) {}
  create(name: string, docs: Doc[]) {
    if (!name) throw new Error('参数缺失: name');
    return this.repo.create(name, docs || []);
  }
  addDocs(name: string, docs: Doc[]) {
    if (!docs || !docs.length) throw new Error('参数缺失: docs');
    return this.repo.addDocs(name, docs);
  }
  search(name: string, q: string) {
    if (!q) throw new Error('参数缺失: q');
    return this.repo.search(name, q);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new SearchService(new SearchRepository());

router.post('/api/index', (ctx) => {
  try {
    const { name, docs } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.create(name, docs);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/index/:name/docs', (ctx) => {
  try {
    const { docs } = (ctx.request.body || {}) as any;
    ctx.body = service.addDocs(ctx.params.name, docs);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '索引不存在' ? 404 : 400; ctx.body = { message: m }; }
});
router.get('/api/search', (ctx) => {
  try {
    const { index, q } = ctx.query as any;
    ctx.body = service.search(index, q);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '索引不存在' ? 404 : 400; ctx.body = { message: m }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[搜索引擎服务] running at http://localhost:' + PORT);
});
