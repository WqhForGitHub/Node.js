import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 内容管理系统
 * 文章 CRUD 与发布
 */

interface Article {
  id: number;
  title: string;
  content: string;
  author: string;
  status: 'draft' | 'published';
  createdAt: string;
}

// ---- Repository 层 ----
class ArticleRepository {
  private articles: Article[] = [
    { id: 1, title: '欢迎来到 CMS', content: '这是一篇示例文章。', author: 'admin', status: 'published', createdAt: '2024-01-01' },
    { id: 2, title: '草稿示例', content: '草稿内容。', author: 'admin', status: 'draft', createdAt: '2024-02-01' },
  ];
  findAll() {
    return this.articles;
  }
  findById(id: number) {
    return this.articles.find((a) => a.id === id);
  }
  create(data: Partial<Article>) {
    const a: Article = {
      id: Date.now(),
      title: data.title || '',
      content: data.content || '',
      author: data.author || 'anonymous',
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    this.articles.push(a);
    return a;
  }
  update(id: number, data: Partial<Article>) {
    const a = this.findById(id);
    if (!a) return null;
    Object.assign(a, data, { id: a.id, status: a.status, createdAt: a.createdAt });
    return a;
  }
  publish(id: number) {
    const a = this.findById(id);
    if (!a) return null;
    a.status = 'published';
    return a;
  }
  delete(id: number) {
    const idx = this.articles.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.articles.splice(idx, 1);
    return true;
  }
}

// ---- Service 层 ----
class ArticleService {
  constructor(private repo: ArticleRepository) {}
  list() {
    return this.repo.findAll();
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  create(data: Partial<Article>) {
    if (!data.title) throw new Error('标题必填');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Article>) {
    const a = this.repo.update(id, data);
    if (!a) throw new Error('文章不存在');
    return a;
  }
  publish(id: number) {
    const a = this.repo.publish(id);
    if (!a) throw new Error('文章不存在');
    return a;
  }
  delete(id: number) {
    if (!this.repo.delete(id)) throw new Error('文章不存在');
    return true;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ArticleService(new ArticleRepository());

// GET /api/articles - 文章列表
router.get('/api/articles', (ctx) => {
  ctx.body = service.list();
});

// GET /api/articles/:id - 文章详情
router.get('/api/articles/:id', (ctx) => {
  const a = service.get(Number(ctx.params.id));
  if (!a) {
    ctx.status = 404;
    ctx.body = { message: '文章不存在' };
    return;
  }
  ctx.body = a;
});

// POST /api/articles - 创建文章
router.post('/api/articles', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// PUT /api/articles/:id - 更新文章
router.put('/api/articles/:id', (ctx) => {
  try {
    ctx.body = service.update(Number(ctx.params.id), ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

// POST /api/articles/:id/publish - 发布文章
router.post('/api/articles/:id/publish', (ctx) => {
  try {
    ctx.body = service.publish(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

// DELETE /api/articles/:id - 删除文章
router.delete('/api/articles/:id', (ctx) => {
  try {
    service.delete(Number(ctx.params.id));
    ctx.status = 204;
    ctx.body = null;
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[内容管理系统] running at http://localhost:' + PORT);
});
