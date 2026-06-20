import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 知识库平台
 * 知识条目、树形分类、全文模糊搜索
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Article {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  views: number;
  createdAt: string;
}
interface Category {
  id: number;
  name: string;
  parentId: number | null;
}

// 仓储层
class KbRepository {
  private articles: Article[] = [];
  private categories: Category[] = [{ id: 1, name: '根', parentId: null }];
  private aSeq = 0;
  private cSeq = 1;
  createArticle(data: any): Article {
    const a: Article = {
      id: ++this.aSeq,
      title: data.title,
      content: data.content || '',
      categoryId: data.categoryId || 1,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    this.articles.push(a);
    return a;
  }
  findArticle(id: number) {
    return this.articles.find((a) => a.id === id);
  }
  searchArticles(categoryId: number | null, q: string) {
    let list = this.articles;
    if (categoryId) list = list.filter((a) => a.categoryId === categoryId);
    if (q) {
      const kw = q.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(kw) || a.content.toLowerCase().includes(kw),
      );
    }
    return list;
  }
  createCategory(name: string, parentId: number | null) {
    if (parentId && !this.categories.find((c) => c.id === parentId)) return null;
    const c = { id: ++this.cSeq, name, parentId };
    this.categories.push(c);
    return c;
  }
  allCategories() {
    return this.categories;
  }
}

// 服务层：构建分类树
class KbService {
  constructor(private repo: KbRepository) {}
  create(data: any) {
    if (!data.title) throw new Error('title 必填');
    return this.repo.createArticle(data);
  }
  search(categoryId: string | undefined, q: string | undefined) {
    return this.repo.searchArticles(categoryId ? Number(categoryId) : null, (q || '').toString());
  }
  get(id: number) {
    const a = this.repo.findArticle(id);
    if (a) a.views++;
    return a;
  }
  categoryTree() {
    const list = this.repo.allCategories();
    const map = new Map<number, any>();
    const roots: any[] = [];
    list.forEach((c) => map.set(c.id, { ...c, children: [] }));
    list.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parentId === null || !map.has(c.parentId)) roots.push(node);
      else map.get(c.parentId)!.children.push(node);
    });
    return roots;
  }
  createCategory(data: any) {
    if (!data.name) throw new Error('name 必填');
    const c = this.repo.createCategory(data.name, data.parentId ?? null);
    if (!c) throw new Error('父分类不存在');
    return c;
  }
}

const repo = new KbRepository();
const service = new KbService(repo);

// POST /api/kb/articles - 创建知识条目
router.post('/api/kb/articles', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/kb/articles?categoryId=&q= - 分类过滤 + 全文模糊搜索
router.get('/api/kb/articles', (ctx) => {
  ctx.body = service.search(ctx.query.categoryId as string, ctx.query.q as string);
});
// GET /api/kb/articles/:id - 详情（浏览量+1）
router.get('/api/kb/articles/:id', (ctx) => {
  const a = service.get(Number(ctx.params.id));
  if (!a) {
    ctx.status = 404;
    ctx.body = { message: '条目不存在' };
    return;
  }
  ctx.body = a;
});
// GET /api/kb/categories - 树形分类
router.get('/api/kb/categories', (ctx) => {
  ctx.body = service.categoryTree();
});
// POST /api/kb/categories - 创建分类
router.post('/api/kb/categories', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.createCategory(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[知识库平台] running at http://localhost:' + PORT));
