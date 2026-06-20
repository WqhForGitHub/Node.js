import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 订单处理系统
 * 订单状态流转：待付款 -> 已付款 -> 已发货 -> 已完成；任意未完成态 -> 已取消
 */

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

interface Order {
  id: number;
  amount: number;
  status: OrderStatus;
  createdAt: string;
}

// ---- Repository 层 ----
class OrderRepository {
  private orders: Order[] = [];
  create(amount: number) {
    const o: Order = {
      id: Date.now(),
      amount,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    this.orders.push(o);
    return o;
  }
  findById(id: number) {
    return this.orders.find((o) => o.id === id);
  }
  updateStatus(id: number, status: OrderStatus) {
    const o = this.findById(id);
    if (!o) return null;
    o.status = status;
    return o;
  }
}

// ---- Service 层 ----
class OrderService {
  constructor(private repo: OrderRepository) {}
  create(amount: number) {
    if (!amount || amount <= 0) throw new Error('订单金额必须大于 0');
    return this.repo.create(amount);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  private transition(id: number, from: OrderStatus[], to: OrderStatus, label: string) {
    const o = this.repo.findById(id);
    if (!o) throw new Error('订单不存在');
    if (!from.includes(o.status)) {
      throw new StatusError(`当前状态 ${o.status} 不能${label}`);
    }
    return this.repo.updateStatus(id, to)!;
  }
  pay(id: number) {
    return this.transition(id, ['pending'], 'paid', '付款');
  }
  ship(id: number) {
    return this.transition(id, ['paid'], 'shipped', '发货');
  }
  complete(id: number) {
    return this.transition(id, ['shipped'], 'completed', '完成');
  }
  cancel(id: number) {
    return this.transition(id, ['pending', 'paid', 'shipped'], 'cancelled', '取消');
  }
}

// 自定义错误：用于区分 400（状态非法）与 404（不存在）
class StatusError extends Error {}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new OrderService(new OrderRepository());

// POST /api/orders - 创建订单（待付款）
router.post('/api/orders', (ctx) => {
  try {
    const { amount } = (ctx.request.body as any) || {};
    ctx.status = 201;
    ctx.body = service.create(Number(amount));
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/orders/:id - 订单详情
router.get('/api/orders/:id', (ctx) => {
  const o = service.get(Number(ctx.params.id));
  if (!o) {
    ctx.status = 404;
    ctx.body = { message: '订单不存在' };
    return;
  }
  ctx.body = o;
});

// POST /api/orders/:id/pay - 待付款 -> 已付款
router.post('/api/orders/:id/pay', (ctx) => {
  try {
    ctx.body = service.pay(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e instanceof StatusError ? 400 : 404;
    ctx.body = { message: e.message };
  }
});

// POST /api/orders/:id/ship - 已付款 -> 已发货
router.post('/api/orders/:id/ship', (ctx) => {
  try {
    ctx.body = service.ship(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e instanceof StatusError ? 400 : 404;
    ctx.body = { message: e.message };
  }
});

// POST /api/orders/:id/complete - 已发货 -> 已完成
router.post('/api/orders/:id/complete', (ctx) => {
  try {
    ctx.body = service.complete(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e instanceof StatusError ? 400 : 404;
    ctx.body = { message: e.message };
  }
});

// POST /api/orders/:id/cancel - 取消订单
router.post('/api/orders/:id/cancel', (ctx) => {
  try {
    ctx.body = service.cancel(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e instanceof StatusError ? 400 : 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[订单处理系统] running at http://localhost:' + PORT);
});
