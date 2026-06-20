import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 优惠券系统
 * 模板创建、领取（记录用户券）、核销（按 code）、查询已领券
 */

interface CouponTemplate {
  id: number;
  name: string;
  discount: number;
  total: number; // 总量
  claimed: number; // 已领取
}

type UserCouponStatus = 'unused' | 'used';

interface UserCoupon {
  code: string;
  templateId: number;
  userId: number;
  status: UserCouponStatus;
  claimedAt: string;
}

// ---- Repository 层 ----
class CouponRepository {
  private templates: CouponTemplate[] = [
    { id: 1, name: '满100减20', discount: 20, total: 100, claimed: 0 },
  ];
  private userCoupons: UserCoupon[] = [];
  findTemplates() {
    return this.templates;
  }
  findTemplate(id: number) {
    return this.templates.find((t) => t.id === id);
  }
  createTemplate(t: CouponTemplate) {
    this.templates.push(t);
    return t;
  }
  findUserCouponsByUser(userId: number) {
    return this.userCoupons.filter((c) => c.userId === userId);
  }
  findUserCouponByCode(code: string) {
    return this.userCoupons.find((c) => c.code === code);
  }
  addUserCoupon(c: UserCoupon) {
    this.userCoupons.push(c);
    return c;
  }
}

// ---- Service 层 ----
class CouponService {
  constructor(private repo: CouponRepository) {}
  listTemplates() {
    return this.repo.findTemplates();
  }
  createTemplate(name: string, discount: number, total: number) {
    if (!name) throw new Error('缺少 name');
    if (discount == null || discount < 0) throw new Error('discount 非法');
    if (!total || total <= 0) throw new Error('total 非法');
    return this.repo.createTemplate({
      id: Date.now(),
      name,
      discount,
      total,
      claimed: 0,
    });
  }
  // 领取优惠券
  claim(templateId: number, userId: number) {
    if (!userId) throw new Error('缺少 userId');
    const t = this.repo.findTemplate(templateId);
    if (!t) throw new Error('优惠券模板不存在');
    if (t.claimed >= t.total) throw new Error('优惠券已领完');
    t.claimed += 1;
    const userCoupon: UserCoupon = {
      code: 'C' + Date.now() + Math.floor(Math.random() * 1000),
      templateId,
      userId,
      status: 'unused',
      claimedAt: new Date().toISOString(),
    };
    return this.repo.addUserCoupon(userCoupon);
  }
  // 核销：按 code
  redeem(code: string, userId: number) {
    if (!code) throw new Error('缺少 code');
    const c = this.repo.findUserCouponByCode(code);
    if (!c) throw new Error('券码不存在');
    if (userId && c.userId !== userId) throw new Error('券不属于该用户');
    if (c.status === 'used') throw new Error('券已被核销');
    c.status = 'used';
    return c;
  }
  myCoupons(userId: number) {
    return this.repo.findUserCouponsByUser(userId);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new CouponService(new CouponRepository());

// 模板列表
router.get('/api/coupons', (ctx) => {
  ctx.body = service.listTemplates();
});
// 创建模板
router.post('/api/coupons', (ctx) => {
  const { name, discount, total } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.createTemplate(name, Number(discount), Number(total));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 领取
router.post('/api/coupons/:id/claim', (ctx) => {
  const { userId } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.claim(Number(ctx.params.id), Number(userId));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 核销
router.post('/api/coupons/redeem', (ctx) => {
  const { code, userId } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.redeem(code, Number(userId));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询用户已领券
router.get('/api/coupons/my', (ctx) => {
  const userId = Number(ctx.query.userId);
  if (!userId) {
    ctx.status = 400;
    ctx.body = { message: '缺少 userId' };
    return;
  }
  ctx.body = service.myCoupons(userId);
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[优惠券系统] running at http://localhost:' + PORT);
});
