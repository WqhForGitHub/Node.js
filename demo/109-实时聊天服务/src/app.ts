import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 实时聊天服务
 * 聊天室、消息（HTTP 模拟）
 */
interface Room { id: number; name: string; members: string[]; createdAt: number; }
interface Message { id: number; roomId: number; userId: string; content: string; createdAt: number; }

// ---- Repository 层 ----
class ChatRepository {
  private rooms: Room[] = [];
  private messages: Message[] = [];
  createRoom(name: string) {
    const r: Room = { id: Date.now() + Math.floor(Math.random() * 1000), name, members: [], createdAt: Date.now() };
    this.rooms.push(r);
    return r;
  }
  findRoom(id: number) { return this.rooms.find((r) => r.id === id); }
  joinRoom(id: number, userId: string) {
    const r = this.findRoom(id);
    if (!r) return null;
    if (!r.members.includes(userId)) r.members.push(userId);
    return r;
  }
  addMessage(roomId: number, userId: string, content: string) {
    const m: Message = { id: Date.now() + Math.floor(Math.random() * 1000), roomId, userId, content, createdAt: Date.now() };
    this.messages.push(m);
    return m;
  }
  listMessages(roomId: number, before: number | undefined, page: number, size: number) {
    let l = this.messages.filter((m) => m.roomId === roomId);
    if (before) l = l.filter((m) => m.id < before);
    l = l.sort((a, b) => b.createdAt - a.createdAt);
    const total = l.length;
    const start = (page - 1) * size;
    return { total, page, size, data: l.slice(start, start + size) };
  }
  members(roomId: number) { const r = this.findRoom(roomId); return r ? r.members : null; }
}
// ---- Service 层 ----
class ChatService {
  constructor(private repo: ChatRepository) {}
  createRoom(name: string) { if (!name) throw new Error('参数缺失: name'); return this.repo.createRoom(name); }
  sendMessage(roomId: number, userId: string, content: string) {
    if (!userId || !content) throw new Error('参数缺失: userId/content');
    if (!this.repo.findRoom(roomId)) throw new Error('房间不存在');
    return this.repo.addMessage(roomId, userId, content);
  }
  messages(roomId: number, before: number | undefined, page: number, size: number) {
    if (!this.repo.findRoom(roomId)) throw new Error('房间不存在');
    return this.repo.listMessages(roomId, before, page, size);
  }
  join(roomId: number, userId: string) {
    if (!userId) throw new Error('参数缺失: userId');
    const r = this.repo.joinRoom(roomId, userId);
    if (!r) throw new Error('房间不存在');
    return r;
  }
  members(roomId: number) { const m = this.repo.members(roomId); if (m === null) throw new Error('房间不存在'); return m; }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ChatService(new ChatRepository());

router.post('/api/rooms', (ctx) => {
  try {
    const { name } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.createRoom(name);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/rooms/:id/messages', (ctx) => {
  try {
    const { userId, content } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.sendMessage(Number(ctx.params.id), userId, content);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '房间不存在' ? 404 : 400; ctx.body = { message: m }; }
});
router.get('/api/rooms/:id/messages', (ctx) => {
  try {
    const { before, page = '1', size = '20' } = ctx.query as any;
    ctx.body = service.messages(Number(ctx.params.id), before ? Number(before) : undefined, Number(page), Number(size));
  } catch (e) { ctx.status = 404; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/rooms/:id/members', (ctx) => {
  try {
    const { userId } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.join(Number(ctx.params.id), userId);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '房间不存在' ? 404 : 400; ctx.body = { message: m }; }
});
router.get('/api/rooms/:id/members', (ctx) => {
  try { ctx.body = service.members(Number(ctx.params.id)); }
  catch (e) { ctx.status = 404; ctx.body = { message: (e as Error).message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[实时聊天服务] running at http://localhost:' + PORT);
});
