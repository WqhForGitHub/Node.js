import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 支付交易系统
 * 创建支付、查询、回调（pending→paid）、退款（仅 paid 可退）
 */

type PaymentStatus = 'pending' | 'paid' | 'refunded';

interface Payment {
  id: number;
  orderId: number;
  amount: number;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}

// ---- Repository 层 ----
class PaymentRepository {
  private payments: Payment[] = [];
  create(p: Payment) {
    this.payments.push(p);
    return p;
  }
  findById(id: number) {
    return this.payments.find((p) => p.id === id);
  }
  findAll() {
    return this.payments;
  }
  update(p: Payment) {
    return p;
  }
}

// ---- Service 层 ----
class PaymentService {
  constructor(private repo: PaymentRepository) {}
  create(orderId: number, amount: number) {
    if (!orderId) throw new Error('缺少 orderId');
    if (!amount || amount <= 0) throw new Error('金额必须大于 0');
    const payment: Payment = {
      id: Date.now(),
      orderId,
      amount,
      status: 'pending',
      paidAt: null,
      createdAt: new Date().toISOString(),
    };
    return this.repo.create(payment);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  // 支付回调：pending → paid
  callback(id: number) {
    const p = this.repo.findById(id);
    if (!p) throw new Error('支付单不存在');
    if (p.status !== 'pending') throw new Error('当前状态不可回调: ' + p.status);
    p.status = 'paid';
    p.paidAt = new Date().toISOString();
    return this.repo.update(p);
  }
  // 退款：仅 paid 可退
  refund(id: number) {
    const p = this.repo.findById(id);
    if (!p) throw new Error('支付单不存在');
    if (p.status !== 'paid') throw new Error('仅已支付订单可退款，当前: ' + p.status);
    p.status = 'refunded';
    return this.repo.update(p);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new PaymentService(new PaymentRepository());

// 创建支付单
router.post('/api/payments', (ctx) => {
  const { orderId, amount } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.create(Number(orderId), Number(amount));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询支付单
router.get('/api/payments/:id', (ctx) => {
  const p = service.get(Number(ctx.params.id));
  if (!p) {
    ctx.status = 404;
    ctx.body = { message: '支付单不存在' };
    return;
  }
  ctx.body = p;
});
// 支付回调
router.post('/api/payments/:id/callback', (ctx) => {
  try {
    ctx.body = service.callback(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 退款
router.post('/api/payments/:id/refund', (ctx) => {
  try {
    ctx.body = service.refund(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[支付交易系统] running at http://localhost:' + PORT);
});
