import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 事务管理系统
 * 事务 begin/commit/rollback
 * 事务管理: 模拟 begin/commit/rollback
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

const accounts = new Map<number, number>([
  [1, 1000],
  [2, 500],
]);

class Tx {
  private backup = new Map<number, number>();
  private done = false;
  begin() {
    for (const [k, v] of accounts) this.backup.set(k, v);
  }
  transfer(from: number, to: number, amount: number) {
    if (this.done) throw new Error('事务已结束');
    const f = accounts.get(from);
    const t = accounts.get(to);
    if (f === undefined || t === undefined) throw new Error('账户不存在');
    if (f < amount) throw new Error('余额不足');
    accounts.set(from, f - amount);
    accounts.set(to, t + amount);
  }
  commit() {
    this.done = true;
  }
  rollback() {
    for (const [k, v] of this.backup) accounts.set(k, v);
    this.done = true;
  }
}

router.get('/accounts', (ctx) => {
  ctx.body = [...accounts.entries()].map(([id, balance]) => ({ id, balance }));
});
router.post('/transfer', (ctx) => {
  const { from, to, amount } = (ctx.request.body || {}) as {
    from: number;
    to: number;
    amount: number;
  };
  const tx = new Tx();
  tx.begin();
  try {
    tx.transfer(from, to, amount);
    tx.commit();
    ctx.body = { success: true };
  } catch (e) {
    tx.rollback();
    ctx.status = 400;
    ctx.body = { success: false, message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[事务管理系统] running'));
