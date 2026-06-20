import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 电商后端系统
 * 商品 + 订单概览
 */

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}
interface Order {
  id: number;
  productId: number;
  quantity: number;
  totalAmount: number;
  status: 'created' | 'paid';
  createdAt: string;
}

// ---- Repository 层 ----
class ShopRepository {
  private products: Product[] = [
    { id: 1, name: '键盘', price: 199.0, stock: 50 },
    { id: 2, name: '鼠标', price: 88.0, stock: 100 },
    { id: 3, name: '显示器', price: 1299.0, stock: 10 },
  ];
  private orders: Order[] = [];
  listProducts() {
    return this.products;
  }
  findProduct(id: number) {
    return this.products.find((p) => p.id === id);
  }
  listOrders() {
    return this.orders;
  }
  findOrder(id: number) {
    return this.orders.find((o) => o.id === id);
  }
  createOrder(productId: number, quantity: number) {
    const p = this.findProduct(productId);
    if (!p) return null;
    if (p.stock < quantity) return null;
    p.stock -= quantity;
    const o: Order = {
      id: Date.now(),
      productId,
      quantity,
      totalAmount: +(p.price * quantity).toFixed(2),
      status: 'created',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    this.orders.push(o);
    return o;
  }
}

// ---- Service 层 ----
class ShopService {
  constructor(private repo: ShopRepository) {}
  listProducts() {
    return this.repo.listProducts();
  }
  getProduct(id: number) {
    return this.repo.findProduct(id);
  }
  listOrders() {
    return this.repo.listOrders();
  }
  getOrder(id: number) {
    return this.repo.findOrder(id);
  }
  createOrder(productId: number, quantity: number) {
    if (!productId || !quantity || quantity <= 0) throw new Error('参数非法');
    const o = this.repo.createOrder(productId, quantity);
    if (!o) throw new Error('商品不存在或库存不足');
    return o;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ShopService(new ShopRepository());

// GET /api/products - 商品列表
router.get('/api/products', (ctx) => {
  ctx.body = service.listProducts();
});

// GET /api/products/:id - 商品详情
router.get('/api/products/:id', (ctx) => {
  const p = service.getProduct(Number(ctx.params.id));
  if (!p) {
    ctx.status = 404;
    ctx.body = { message: '商品不存在' };
    return;
  }
  ctx.body = p;
});

// POST /api/orders - 创建订单
router.post('/api/orders', (ctx) => {
  try {
    const { productId, quantity } = (ctx.request.body as any) || {};
    ctx.status = 201;
    ctx.body = service.createOrder(Number(productId), Number(quantity));
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/orders - 订单列表
router.get('/api/orders', (ctx) => {
  ctx.body = service.listOrders();
});

// GET /api/orders/:id - 订单详情
router.get('/api/orders/:id', (ctx) => {
  const o = service.getOrder(Number(ctx.params.id));
  if (!o) {
    ctx.status = 404;
    ctx.body = { message: '订单不存在' };
    return;
  }
  ctx.body = o;
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[电商后端系统] running at http://localhost:' + PORT);
});
