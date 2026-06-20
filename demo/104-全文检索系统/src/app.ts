import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 全文检索系统
 * 倒排索引实现
 */
interface Doc { id: string; content: string; }

// ---- Repository 层 ----
class FullTextRepository {
  private docs: Doc[] = [];
  private index: Map<string, Set<string>> = new Map(); // token -> docIds
  add(doc: Doc) {
    if (this.docs.find((d) => d.id === doc.id)) throw new Error('文档已存在');
    this.docs.push(doc);
    this.tokenize(doc.content).forEach((t) => {
      if (!this.index.has(t)) this.index.set(t, new Set());
      this.index.get(t)!.add(doc.id);
    });
    return doc;
  }
  getDoc(id: string) { return this.docs.find((d) => d.id === id); }
  tokenize(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
  }
  getIndex() { return this.index; }
}
// ---- Service 层 ----
class FullTextService {
  constructor(private repo: FullTextRepository) {}
  addDocument(id: string, content: string) {
    if (!id || !content) throw new Error('参数缺失: id/content');
    return this.repo.add({ id, content });
  }
  // 构建倒排索引 map<token, docIds[]>
  buildIndex() {
    const map: Record<string, string[]> = {};
    this.repo.getIndex().forEach((set, token) => { map[token] = Array.from(set); });
    return map;
  }
  search(q: string, mode: 'AND' | 'OR' = 'AND') {
    if (!q) throw new Error('参数缺失: q');
    const tokens = this.repo.tokenize(q);
    if (!tokens.length) return { total: 0, hits: [], termFrequency: {} };
    const sets = tokens.map((t) => this.repo.getIndex().get(t) || new Set<string>());
    let result: Set<string>;
    if (mode === 'AND') {
      result = new Set(sets[0]);
      for (let i = 1; i < sets.length; i++) result = new Set([...result].filter((id) => sets[i].has(id)));
    } else {
      result = new Set<string>();
      sets.forEach((s) => s.forEach((id) => result.add(id)));
    }
    const hits = [...result].map((id) => this.repo.getDoc(id)).filter(Boolean) as Doc[];
    const termFrequency: Record<string, number> = {};
    tokens.forEach((t) => { termFrequency[t] = this.repo.getIndex().get(t)?.size || 0; });
    return { total: hits.length, hits, termFrequency };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new FullTextService(new FullTextRepository());

router.post('/api/documents', (ctx) => {
  try {
    const { id, content } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.addDocument(id, content);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/search', (ctx) => {
  try {
    const { q, mode } = ctx.query as any;
    ctx.body = service.search(q, (mode as 'AND' | 'OR') || 'AND');
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[全文检索系统] running at http://localhost:' + PORT);
});
