import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 邮件服务系统
 * 邮件队列、发送、状态
 */
type EmailStatus = 'queued' | 'sent' | 'failed';
interface Email { id: number; to: string; subject: string; body: string; status: EmailStatus; sentAt: number | null; createdAt: number; }

// ---- Repository 层 ----
class EmailRepository {
  private emails: Email[] = [];
  add(e: Email) { this.emails.push(e); return e; }
  findAll(status?: EmailStatus) { return status ? this.emails.filter((e) => e.status === status) : this.emails; }
  findById(id: number) { return this.emails.find((e) => e.id === id); }
  updateStatus(id: number, status: EmailStatus, sentAt: number | null) {
    const e = this.findById(id);
    if (!e) return null;
    e.status = status;
    e.sentAt = sentAt;
    return e;
  }
}
// ---- Service 层 ----
class EmailService {
  constructor(private repo: EmailRepository) {}
  enqueue(to: string, subject: string, body: string) {
    if (!to || !subject || !body) throw new Error('参数缺失: to/subject/body');
    return this.repo.add({ id: Date.now() + Math.floor(Math.random() * 1000), to, subject, body, status: 'queued', sentAt: null, createdAt: Date.now() });
  }
  list(status?: EmailStatus) { return this.repo.findAll(status); }
  get(id: number) { const e = this.repo.findById(id); if (!e) throw new Error('邮件不存在'); return e; }
  send(id: number) {
    const e = this.repo.findById(id);
    if (!e) throw new Error('邮件不存在');
    if (e.status !== 'queued') throw new Error('当前状态不允许发送: ' + e.status);
    // 模拟发送，随机失败
    const success = Math.random() > 0.3;
    return this.repo.updateStatus(id, success ? 'sent' : 'failed', success ? Date.now() : null)!;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new EmailService(new EmailRepository());

router.post('/api/emails', (ctx) => {
  try {
    const { to, subject, body } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.enqueue(to, subject, body);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/emails', (ctx) => {
  const { status } = ctx.query as any;
  ctx.body = service.list(status);
});
router.post('/api/emails/:id/send', (ctx) => {
  try { ctx.body = service.send(Number(ctx.params.id)); }
  catch (e) { const m = (e as Error).message; ctx.status = m === '邮件不存在' ? 404 : 400; ctx.body = { message: m }; }
});
router.get('/api/emails/:id', (ctx) => {
  try { ctx.body = service.get(Number(ctx.params.id)); }
  catch (e) { ctx.status = 404; ctx.body = { message: (e as Error).message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[邮件服务系统] running at http://localhost:' + PORT);
});
