import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 商品管理平台
 * 商品 CRUD 与分类管理
 */

interface Category {
  id: number;
  name: string;
}
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  categoryId: number;
  description: string;
}

// ---- Repository 层 ----
class ProductRepository {
  private categories: Category[] = [
    { id: 1, name: '电子产品' },
    { id: 2, name: '办公用品' },
  ];
  private products: Product[] = [
    { id: 1, name: '键盘', price: 199.0, stock: 50, categoryId: 1, description: '机械键盘' },
    { id: 2, name: '鼠标', price: 88.0, stock: 100, categoryId: 1, description: '无线鼠标' },
    { id: 3, name: '笔记本', price: 5.0, stock: 200, categoryId: 2, description: 'A5 笔记本' },
  ];
  listCategories() {
    return this.categories;
  }
  createCategory(name: string) {
    const c: Category = { id: Date.now(), name };
    this.categories.push(c);
    return c;
  }
  listProducts(categoryId?: number, keyword?: string) {
    return this.products.filter((p) => {
      const okCat = !categoryId || p.categoryId === Number(categoryId);
      const okKw =
        !keyword ||
        p.name.toLowerCase().includes(keyword.toLowerCase()) ||
        p.description.toLowerCase().includes(keyword.toLowerCase());
      return okCat && okKw;
    });
  }
  findById(id: number) {
    return this.products.find((p) => p.id === id);
  }
  create(data: Partial<Product>) {
    const p: Product = {
      id: Date.now(),
      name: data.name || '',
      price: data.price || 0,
      stock: data.stock || 0,
      categoryId: data.categoryId || 0,
      description: data.description || '',
    };
    this.products.push(p);
    return p;
  }
  update(id: number, data: Partial<Product>) {
    const p = this.findById(id);
    if (!p) return null;
    Object.assign(p, data, { id: p.id });
    return p;
  }
  delete(id: number) {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.products.splice(idx, 1);
    return true;
  }
  categoryExists(id: number) {
    return this.categories.some((c) => c.id === id);
  }
}

// ---- Service 层 ----
class ProductService {
  constructor(private repo: ProductRepository) {}
  listCategories() {
    return this.repo.listCategories();
  }
  createCategory(name: string) {
    if (!name) throw new Error('分类名必填');
    return this.repo.createCategory(name);
  }
  listProducts(categoryId?: string, keyword?: string) {
    return this.repo.listProducts(categoryId ? Number(categoryId) : undefined, keyword);
  }
  create(data: Partial<Product>) {
    if (!data.name) throw new Error('商品名必填');
    if (data.categoryId && !this.repo.categoryExists(Number(data.categoryId))) {
      throw new Error('分类不存在');
    }
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Product>) {
    const p = this.repo.update(id, data);
    if (!p) throw new Error('商品不存在');
    return p;
  }
  delete(id: number) {
    if (!this.repo.delete(id)) throw new Error('商品不存在');
    return true;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ProductService(new ProductRepository());

// GET /api/categories - 分类列表
router.get('/api/categories', (ctx) => {
  ctx.body = service.listCategories();
});

// POST /api/categories - 创建分类
router.post('/api/categories', (ctx) => {
  try {
    const { name } = (ctx.request.body as any) || {};
    ctx.status = 201;
    ctx.body = service.createCategory(name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/products - 商品列表（支持 categoryId 过滤、keyword 搜索）
router.get('/api/products', (ctx) => {
  const { categoryId, keyword } = ctx.query;
  ctx.body = service.listProducts(categoryId as string, keyword as string);
});

// POST /api/products - 创建商品
router.post('/api/products', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// PUT /api/products/:id - 更新商品
router.put('/api/products/:id', (ctx) => {
  try {
    ctx.body = service.update(Number(ctx.params.id), (ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

// DELETE /api/products/:id - 删除商品
router.delete('/api/products/:id', (ctx) => {
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
  console.log('[商品管理平台] running at http://localhost:' + PORT);
});
