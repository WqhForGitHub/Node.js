import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 消息通知中心
 * 通知发送、列表、已读
 */
interface Notification { id: number; userId: string; title: string; content: string; type: string; read: boolean; createdAt: number; }

// ---- Repository 层 ----
class NotificationRepository {
  private list: Notification[] = [];
  add(n: Notification) { this.list.push(n); return n; }
  findByUser(userId: string, type?: string, page = 1, size = 10) {
    let l = this.list.filter((n) => n.userId === userId);
    if (type) l = l.filter((n) => n.type === type);
    const total = l.length;
    const start = (page - 1) * size;
    return { total, page, size, data: l.slice(start, start + size) };
  }
  findById(id: number) { return this.list.find((n) => n.id === id); }
  markRead(id: number) { const n = this.findById(id); if (!n) return null; n.read = true; return n; }
  markAllRead(userId: string) {
    let count = 0;
    this.list.forEach((n) => { if (n.userId === userId && !n.read) { n.read = true; count++; } });
    return count;
  }
  unreadCount(userId: string) { return this.list.filter((n) => n.userId === userId && !n.read).length; }
}
// ---- Service 层 ----
class NotificationService {
  constructor(private repo: NotificationRepository) {}
  send(userId: string, title: string, content: string, type: string) {
    if (!userId || !title || !content || !type) throw new Error('参数缺失: userId/title/content/type');
    return this.repo.add({ id: Date.now() + Math.floor(Math.random() * 1000), userId, title, content, type, read: false, createdAt: Date.now() });
  }
  list(userId: string, type?: string, page?: number, size?: number) {
    if (!userId) throw new Error('参数缺失: userId');
    return this.repo.findByUser(userId, type, page, size);
  }
  markRead(id: number) { const n = this.repo.markRead(id); if (!n) throw new Error('通知不存在'); return n; }
  markAllRead(userId: string) {
    if (!userId) throw new Error('参数缺失: userId');
    return { updated: this.repo.markAllRead(userId) };
  }
  unreadCount(userId: string) {
    if (!userId) throw new Error('参数缺失: userId');
    return { userId, unread: this.repo.unreadCount(userId) };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new NotificationService(new NotificationRepository());

router.post('/api/notifications', (ctx) => {
  try {
    const { userId, title, content, type } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.send(userId, title, content, type);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/notifications/read-all', (ctx) => {
  try { const { userId } = (ctx.request.body || {}) as any; ctx.body = service.markAllRead(userId); }
  catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/notifications/unread-count', (ctx) => {
  try { const { userId } = ctx.query as any; ctx.body = service.unreadCount(userId); }
  catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/notifications', (ctx) => {
  try {
    const { userId, type, page = '1', size = '10' } = ctx.query as any;
    ctx.body = service.list(userId, type, Number(page), Number(size));
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/notifications/:id/read', (ctx) => {
  try { ctx.body = service.markRead(Number(ctx.params.id)); }
  catch (e) { const m = (e as Error).message; ctx.status = m === '通知不存在' ? 404 : 400; ctx.body = { message: m }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[消息通知中心] running at http://localhost:' + PORT);
});
