import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 发票管理服务
 * 发票开具、查询（按 userId/状态过滤）、作废
 */

type InvoiceType = '个人' | '企业';
type InvoiceStatus = 'valid' | 'void';

interface Invoice {
  id: number;
  userId: number;
  title: string;
  amount: number;
  type: InvoiceType;
  status: InvoiceStatus;
  invoiceNo: string;
  createdAt: string;
}

// ---- Repository 层 ----
class InvoiceRepository {
  private invoices: Invoice[] = [];
  private seq = 1000;
  findAll(filter: (i: Invoice) => boolean) {
    return this.invoices.filter(filter);
  }
  findById(id: number) {
    return this.invoices.find((i) => i.id === id);
  }
  create(i: Invoice) {
    this.invoices.push(i);
    return i;
  }
  nextNo() {
    this.seq += 1;
    return 'INV' + this.seq;
  }
}

// ---- Service 层 ----
class InvoiceService {
  constructor(private repo: InvoiceRepository) {}
  // 开票
  issue(userId: number, title: string, amount: number, type: InvoiceType) {
    if (!userId) throw new Error('缺少 userId');
    if (!title) throw new Error('缺少 title');
    if (!amount || amount <= 0) throw new Error('amount 必须大于 0');
    if (type !== '个人' && type !== '企业') throw new Error('type 必须为 个人 或 企业');
    const inv: Invoice = {
      id: Date.now(),
      userId,
      title,
      amount,
      type,
      status: 'valid',
      invoiceNo: this.repo.nextNo(),
      createdAt: new Date().toISOString(),
    };
    return this.repo.create(inv);
  }
  list(userId?: string, status?: string) {
    return this.repo.findAll((i) => {
      if (userId && i.userId !== Number(userId)) return false;
      if (status && i.status !== status) return false;
      return true;
    });
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  // 作废
  void(id: number) {
    const inv = this.repo.findById(id);
    if (!inv) throw new Error('发票不存在');
    if (inv.status === 'void') throw new Error('发票已作废');
    inv.status = 'void';
    return inv;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new InvoiceService(new InvoiceRepository());

// 开票
router.post('/api/invoices', (ctx) => {
  const { userId, title, amount, type } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.issue(Number(userId), title, Number(amount), type);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询列表（按 userId/状态过滤）
router.get('/api/invoices', (ctx) => {
  ctx.body = service.list(ctx.query.userId as string, ctx.query.status as string);
});
// 查询详情
router.get('/api/invoices/:id', (ctx) => {
  const inv = service.get(Number(ctx.params.id));
  if (!inv) {
    ctx.status = 404;
    ctx.body = { message: '发票不存在' };
    return;
  }
  ctx.body = inv;
});
// 作废
router.post('/api/invoices/:id/void', (ctx) => {
  try {
    ctx.body = service.void(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[发票管理服务] running at http://localhost:' + PORT);
});
