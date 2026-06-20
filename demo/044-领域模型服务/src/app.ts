import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 领域模型服务
 * 领域模型 + 领域服务
 * 领域驱动设计: Entity / ValueObject / DomainService / ApplicationService
 */
// 实体
class Order {
  constructor(
    public id: number,
    public userId: number,
    public amount: number,
    public status: string = 'created',
  ) {}
  pay() {
    if (this.status !== 'created') throw new Error('订单状态不允许支付');
    this.status = 'paid';
  }
}
// 值对象
class Money {
  constructor(public readonly value: number) {
    if (value < 0) throw new Error('金额不能为负');
  }
}
// 领域服务
class OrderDomainService {
  createOrder(id: number, userId: number, amount: number) {
    const money = new Money(amount);
    return new Order(id, userId, money.value);
  }
}
// 应用服务
class OrderApplicationService {
  private orders: Order[] = [];
  constructor(private domain: OrderDomainService) {}
  create(userId: number, amount: number) {
    const order = this.domain.createOrder(this.orders.length + 1, userId, amount);
    this.orders.push(order);
    return order;
  }
  pay(id: number) {
    const o = this.orders.find((x) => x.id === id);
    if (!o) throw new Error('订单不存在');
    o.pay();
    return o;
  }
  list() {
    return this.orders;
  }
}

const app = new Koa();
const router = new Router();
app.use(bodyParser());
const appService = new OrderApplicationService(new OrderDomainService());

router.post('/orders', (ctx) => {
  const { userId, amount } = (ctx.request.body || {}) as { userId: number; amount: number };
  ctx.status = 201;
  ctx.body = appService.create(userId, amount);
});
router.get('/orders', (ctx) => {
  ctx.body = appService.list();
});
router.post('/orders/:id/pay', (ctx) => {
  try {
    ctx.body = appService.pay(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[领域模型服务] running'));
