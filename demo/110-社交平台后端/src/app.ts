import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 社交平台后端
 * 动态、关注、点赞
 */
interface Post { id: number; userId: string; content: string; likeUserIds: string[]; createdAt: number; }
interface User { id: string; following: string[]; }

// ---- Repository 层 ----
class SocialRepository {
  private posts: Post[] = [];
  private users: Map<string, User> = new Map();
  private getUser(id: string) {
    if (!this.users.has(id)) this.users.set(id, { id, following: [] });
    return this.users.get(id)!;
  }
  createPost(userId: string, content: string) {
    const p: Post = { id: Date.now() + Math.floor(Math.random() * 1000), userId, content, likeUserIds: [], createdAt: Date.now() };
    this.posts.push(p);
    return p;
  }
  listPosts(userId?: string) { return userId ? this.posts.filter((p) => p.userId === userId) : this.posts; }
  findPost(id: number) { return this.posts.find((p) => p.id === id); }
  follow(userId: string, targetId: string) {
    if (userId === targetId) throw new Error('不能关注自己');
    const u = this.getUser(userId);
    if (!u.following.includes(targetId)) u.following.push(targetId);
    return u;
  }
  unfollow(userId: string, targetId: string) {
    const u = this.getUser(userId);
    u.following = u.following.filter((id) => id !== targetId);
    return u;
  }
  feed(userId: string) {
    const u = this.getUser(userId);
    const set = new Set(u.following);
    return this.posts.filter((p) => set.has(p.userId)).sort((a, b) => b.createdAt - a.createdAt);
  }
  like(postId: number, userId: string) {
    const p = this.findPost(postId);
    if (!p) return null;
    if (!p.likeUserIds.includes(userId)) p.likeUserIds.push(userId);
    return p;
  }
  unlike(postId: number, userId: string) {
    const p = this.findPost(postId);
    if (!p) return null;
    p.likeUserIds = p.likeUserIds.filter((id) => id !== userId);
    return p;
  }
}
// ---- Service 层 ----
class SocialService {
  constructor(private repo: SocialRepository) {}
  createPost(userId: string, content: string) {
    if (!userId || !content) throw new Error('参数缺失: userId/content');
    return this.repo.createPost(userId, content);
  }
  posts(userId?: string) { return this.repo.listPosts(userId); }
  follow(userId: string, targetId: string) {
    if (!userId || !targetId) throw new Error('参数缺失: userId/targetId');
    return this.repo.follow(userId, targetId);
  }
  unfollow(userId: string, targetId: string) {
    if (!userId || !targetId) throw new Error('参数缺失: userId/targetId');
    return this.repo.unfollow(userId, targetId);
  }
  feed(userId: string) { return this.repo.feed(userId); }
  like(postId: number, userId: string) {
    if (!userId) throw new Error('参数缺失: userId');
    const p = this.repo.like(postId, userId);
    if (!p) throw new Error('动态不存在');
    return p;
  }
  unlike(postId: number, userId: string) {
    if (!userId) throw new Error('参数缺失: userId');
    const p = this.repo.unlike(postId, userId);
    if (!p) throw new Error('动态不存在');
    return p;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new SocialService(new SocialRepository());

router.post('/api/posts', (ctx) => {
  try {
    const { userId, content } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.createPost(userId, content);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/posts', (ctx) => {
  const { userId } = ctx.query as any;
  ctx.body = service.posts(userId);
});
router.post('/api/users/:id/follow', (ctx) => {
  try {
    const { userId } = (ctx.request.body || {}) as any;
    ctx.body = service.follow(userId, ctx.params.id);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.delete('/api/users/:id/follow', (ctx) => {
  try {
    const userId = ((ctx.request.body || {}) as any).userId || (ctx.query.userId as string);
    ctx.body = service.unfollow(userId, ctx.params.id);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.get('/api/users/:id/feed', (ctx) => {
  ctx.body = service.feed(ctx.params.id);
});
router.post('/api/posts/:id/like', (ctx) => {
  try {
    const { userId } = (ctx.request.body || {}) as any;
    ctx.body = service.like(Number(ctx.params.id), userId);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '动态不存在' ? 404 : 400; ctx.body = { message: m }; }
});
router.delete('/api/posts/:id/like', (ctx) => {
  try {
    const userId = ((ctx.request.body || {}) as any).userId || (ctx.query.userId as string);
    ctx.body = service.unlike(Number(ctx.params.id), userId);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '动态不存在' ? 404 : 400; ctx.body = { message: m }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[社交平台后端] running at http://localhost:' + PORT);
});
