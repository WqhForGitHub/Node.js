import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 财务结算系统
 * 结算账户、结算单、对账确认（按状态过滤）
 */

interface Account {
  id: number;
  name: string;
  balance: number;
}

type SettlementStatus = 'pending' | 'reconciled';

interface Settlement {
  id: number;
  accountId: number;
  amount: number;
  status: SettlementStatus;
  createdAt: string;
  reconciledAt: string | null;
}

// ---- Repository 层 ----
class FinanceRepository {
  private accounts: Account[] = [
    { id: 1, name: '主账户', balance: 10000 },
  ];
  private settlements: Settlement[] = [];
  findAccounts() {
    return this.accounts;
  }
  findAccount(id: number) {
    return this.accounts.find((a) => a.id === id);
  }
  addAccount(a: Account) {
    this.accounts.push(a);
    return a;
  }
  findSettlements(status?: string) {
    if (status) return this.settlements.filter((s) => s.status === status);
    return this.settlements;
  }
  findSettlement(id: number) {
    return this.settlements.find((s) => s.id === id);
  }
  addSettlement(s: Settlement) {
    this.settlements.push(s);
    return s;
  }
}

// ---- Service 层 ----
class FinanceService {
  constructor(private repo: FinanceRepository) {}
  listAccounts() {
    return this.repo.findAccounts();
  }
  createAccount(name: string, balance: number) {
    if (!name) throw new Error('缺少 name');
    return this.repo.addAccount({ id: Date.now(), name, balance: Number(balance) || 0 });
  }
  // 创建结算单
  createSettlement(accountId: number, amount: number) {
    if (!accountId) throw new Error('缺少 accountId');
    if (!amount || amount <= 0) throw new Error('amount 必须大于 0');
    if (!this.repo.findAccount(accountId)) throw new Error('账户不存在');
    return this.repo.addSettlement({
      id: Date.now(),
      accountId,
      amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reconciledAt: null,
    });
  }
  // 对账确认
  reconcile(id: number) {
    const s = this.repo.findSettlement(id);
    if (!s) throw new Error('结算单不存在');
    if (s.status !== 'pending') throw new Error('结算单已对账');
    s.status = 'reconciled';
    s.reconciledAt = new Date().toISOString();
    return s;
  }
  listSettlements(status?: string) {
    return this.repo.findSettlements(status);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new FinanceService(new FinanceRepository());

// 账户列表
router.get('/api/accounts', (ctx) => {
  ctx.body = service.listAccounts();
});
// 创建账户
router.post('/api/accounts', (ctx) => {
  const { name, balance } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.createAccount(name, balance);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 结算单列表（按状态过滤）
router.get('/api/settlements', (ctx) => {
  ctx.body = service.listSettlements(ctx.query.status as string);
});
// 创建结算单
router.post('/api/settlements', (ctx) => {
  const { accountId, amount } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.createSettlement(Number(accountId), Number(amount));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 对账确认
router.post('/api/settlements/:id/reconcile', (ctx) => {
  try {
    ctx.body = service.reconcile(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[财务结算系统] running at http://localhost:' + PORT);
});
