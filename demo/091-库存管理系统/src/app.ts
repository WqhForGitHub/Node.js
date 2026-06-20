import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 库存管理系统
 * 库存查询、入库、出库、库存预警
 */

interface StockItem {
  productId: number;
  productName: string;
  qty: number;
  threshold: number; // 预警阈值
}

// ---- Repository 层 ----
class StockRepository {
  private items: StockItem[] = [
    { productId: 1, productName: '键盘', qty: 50, threshold: 10 },
    { productId: 2, productName: '鼠标', qty: 8, threshold: 10 },
  ];
  findAll() {
    return this.items;
  }
  findByProductId(productId: number) {
    return this.items.find((i) => i.productId === productId);
  }
  upsert(item: StockItem) {
    const idx = this.items.findIndex((i) => i.productId === item.productId);
    if (idx >= 0) this.items[idx] = item;
    else this.items.push(item);
    return item;
  }
  findAlerts() {
    return this.items.filter((i) => i.qty < i.threshold);
  }
}

// ---- Service 层 ----
class StockService {
  constructor(private repo: StockRepository) {}
  list(productId?: string) {
    if (productId) {
      const pid = Number(productId);
      return this.repo.findAll().filter((i) => i.productId === pid);
    }
    return this.repo.findAll();
  }
  get(productId: number) {
    return this.repo.findByProductId(productId);
  }
  // 入库
  stockIn(productId: number, qty: number, productName?: string) {
    if (!qty || qty <= 0) throw new Error('入库数量必须大于 0');
    const item = this.repo.findByProductId(productId);
    if (item) {
      item.qty += qty;
      return this.repo.upsert(item);
    }
    if (!productName) throw new Error('新产品入库需提供 productName');
    return this.repo.upsert({ productId, productName, qty, threshold: 10 });
  }
  // 出库
  stockOut(productId: number, qty: number) {
    if (!qty || qty <= 0) throw new Error('出库数量必须大于 0');
    const item = this.repo.findByProductId(productId);
    if (!item) throw new Error('商品不存在');
    if (item.qty < qty) throw new Error('库存不足');
    item.qty -= qty;
    return this.repo.upsert(item);
  }
  alerts() {
    return this.repo.findAlerts();
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new StockService(new StockRepository());

// 库存列表（支持 productId 过滤）
router.get('/api/stock', (ctx) => {
  ctx.body = service.list(ctx.query.productId as string);
});
// 查询单个商品库存
router.get('/api/stock/:productId', (ctx) => {
  const item = service.get(Number(ctx.params.productId));
  if (!item) {
    ctx.status = 404;
    ctx.body = { message: '商品不存在' };
    return;
  }
  ctx.body = item;
});
// 入库
router.post('/api/stock/in', (ctx) => {
  const { productId, qty, productName } = (ctx.request.body as any) || {};
  if (!productId || !qty) {
    ctx.status = 400;
    ctx.body = { message: '缺少 productId 或 qty' };
    return;
  }
  try {
    ctx.body = service.stockIn(Number(productId), Number(qty), productName);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 出库
router.post('/api/stock/out', (ctx) => {
  const { productId, qty } = (ctx.request.body as any) || {};
  if (!productId || !qty) {
    ctx.status = 400;
    ctx.body = { message: '缺少 productId 或 qty' };
    return;
  }
  try {
    ctx.body = service.stockOut(Number(productId), Number(qty));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 库存预警
router.get('/api/stock/alerts', (ctx) => {
  ctx.body = service.alerts();
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[库存管理系统] running at http://localhost:' + PORT);
});
