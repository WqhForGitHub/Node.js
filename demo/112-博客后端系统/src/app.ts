import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 博客后端系统
 * 文章、标签、分类管理，支持标签/分类过滤与分页
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Post {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  tags: string[];
  status: 'draft' | 'published';
  views: number;
  createdAt: string;
}
interface Category {
  id: number;
  name: string;
}

// 仓储层
class BlogRepository {
  posts: Post[] = [];
  categories: Category[] = [
    { id: 1, name: '默认' },
    { id: 2, name: '技术' },
  ];
  private seq = 0;
  create(data: any): Post {
    const p: Post = {
      id: ++this.seq,
      title: data.title,
      content: data.content || '',
      categoryId: data.categoryId || 1,
      tags: data.tags || [],
      status: data.status || 'draft',
      views: 0,
      createdAt: new Date().toISOString(),
    };
    this.posts.push(p);
    return p;
  }
  findById(id: number) {
    return this.posts.find((p) => p.id === id);
  }
  update(id: number, data: any) {
    const p = this.findById(id);
    if (!p) return null;
    Object.assign(p, data);
    return p;
  }
  delete(id: number) {
    const idx = this.posts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.posts.splice(idx, 1);
    return true;
  }
}

// 服务层
class BlogService {
  constructor(private repo: BlogRepository) {}
  list(query: any) {
    const page = Number(query.page) || 1;
    const size = Number(query.size) || 10;
    let list = this.repo.posts;
    if (query.categoryId) list = list.filter((p) => p.categoryId === Number(query.categoryId));
    if (query.tag) list = list.filter((p) => p.tags.includes(query.tag as string));
    if (query.status) list = list.filter((p) => p.status === query.status);
    const total = list.length;
    list = list.slice((page - 1) * size, page * size);
    return { list, total, page, size };
  }
  get(id: number) {
    const p = this.repo.findById(id);
    if (p) p.views++;
    return p;
  }
  create(data: any) {
    if (!data.title) throw new Error('title 必填');
    return this.repo.create(data);
  }
  update(id: number, data: any) {
    return this.repo.update(id, data);
  }
  delete(id: number) {
    return this.repo.delete(id);
  }
  tags() {
    const set = new Set<string>();
    this.repo.posts.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return [...set];
  }
  categories() {
    return this.repo.categories;
  }
}

const repo = new BlogRepository();
const service = new BlogService(repo);

// GET /api/posts - 文章列表（tag/category 过滤 + 分页）
router.get('/api/posts', (ctx) => {
  ctx.body = service.list(ctx.query);
});
// GET /api/posts/:id - 文章详情（浏览量+1）
router.get('/api/posts/:id', (ctx) => {
  const p = service.get(Number(ctx.params.id));
  if (!p) {
    ctx.status = 404;
    ctx.body = { message: '文章不存在' };
    return;
  }
  ctx.body = p;
});
// POST /api/posts - 创建文章
router.post('/api/posts', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// PUT /api/posts/:id - 更新文章
router.put('/api/posts/:id', (ctx) => {
  const p = service.update(Number(ctx.params.id), ctx.request.body || {});
  if (!p) {
    ctx.status = 404;
    ctx.body = { message: '文章不存在' };
    return;
  }
  ctx.body = p;
});
// DELETE /api/posts/:id - 删除文章
router.delete('/api/posts/:id', (ctx) => {
  if (!service.delete(Number(ctx.params.id))) {
    ctx.status = 404;
    ctx.body = { message: '文章不存在' };
    return;
  }
  ctx.status = 204;
});
// GET /api/tags - 全部标签
router.get('/api/tags', (ctx) => {
  ctx.body = service.tags();
});
// GET /api/categories - 全部分类
router.get('/api/categories', (ctx) => {
  ctx.body = service.categories();
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[博客后端系统] running at http://localhost:' + PORT));
