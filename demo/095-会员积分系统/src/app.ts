import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 会员积分系统
 * 积分账户、赚取、消费（余额不足 400）、流水查询
 */

interface PointsAccount {
  userId: number;
  balance: number;
}

type RecordType = 'earn' | 'spend';

interface PointsRecord {
  id: number;
  userId: number;
  type: RecordType;
  amount: number;
  reason: string;
  createdAt: string;
}

// ---- Repository 层 ----
class PointsRepository {
  private accounts: PointsAccount[] = [{ userId: 1, balance: 100 }];
  private records: PointsRecord[] = [];
  findAccount(userId: number) {
    return this.accounts.find((a) => a.userId === userId);
  }
  ensureAccount(userId: number) {
    let a = this.findAccount(userId);
    if (!a) {
      a = { userId, balance: 0 };
      this.accounts.push(a);
    }
    return a;
  }
  findRecords(userId: number) {
    return this.records.filter((r) => r.userId === userId);
  }
  addRecord(r: PointsRecord) {
    this.records.push(r);
    return r;
  }
}

// ---- Service 层 ----
class PointsService {
  constructor(private repo: PointsRepository) {}
  // 余额
  balance(userId: number) {
    const a = this.repo.ensureAccount(userId);
    return a;
  }
  // 赚取
  earn(userId: number, amount: number, reason: string) {
    if (!userId) throw new Error('缺少 userId');
    if (!amount || amount <= 0) throw new Error('amount 必须大于 0');
    const a = this.repo.ensureAccount(userId);
    a.balance += amount;
    this.repo.addRecord({
      id: Date.now(),
      userId,
      type: 'earn',
      amount,
      reason: reason || 'earn',
      createdAt: new Date().toISOString(),
    });
    return a;
  }
  // 消费
  spend(userId: number, amount: number, reason: string) {
    if (!userId) throw new Error('缺少 userId');
    if (!amount || amount <= 0) throw new Error('amount 必须大于 0');
    const a = this.repo.ensureAccount(userId);
    if (a.balance < amount) throw new Error('余额不足');
    a.balance -= amount;
    this.repo.addRecord({
      id: Date.now(),
      userId,
      type: 'spend',
      amount,
      reason: reason || 'spend',
      createdAt: new Date().toISOString(),
    });
    return a;
  }
  records(userId: number) {
    return this.repo.findRecords(userId);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new PointsService(new PointsRepository());

// 查询余额
router.get('/api/points/:userId', (ctx) => {
  ctx.body = service.balance(Number(ctx.params.userId));
});
// 赚取积分
router.post('/api/points/earn', (ctx) => {
  const { userId, amount, reason } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.earn(Number(userId), Number(amount), reason);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 消费积分
router.post('/api/points/spend', (ctx) => {
  const { userId, amount, reason } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.spend(Number(userId), Number(amount), reason);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 流水查询
router.get('/api/points/:userId/records', (ctx) => {
  ctx.body = service.records(Number(ctx.params.userId));
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[会员积分系统] running at http://localhost:' + PORT);
});
