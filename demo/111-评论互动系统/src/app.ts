import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 评论互动系统
 * 评论、回复、点赞，构建 parentId 关联的评论树
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// 评论数据模型
interface Comment {
  id: number;
  targetId: string;
  userId: string;
  content: string;
  parentId: number | null;
  likes: number;
  createdAt: string;
}

// 仓储层：内存存储
class CommentRepository {
  private comments: Comment[] = [];
  private seq = 0;
  create(data: Partial<Comment> & { targetId: string; userId: string; content: string }): Comment {
    const c: Comment = {
      id: ++this.seq,
      targetId: data.targetId,
      userId: data.userId,
      content: data.content,
      parentId: data.parentId ?? null,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    this.comments.push(c);
    return c;
  }
  findById(id: number) { return this.comments.find((c) => c.id === id); }
  findByTarget(targetId: string) { return this.comments.filter((c) => c.targetId === targetId); }
  like(id: number) { const c = this.findById(id); if (c) c.likes++; return c; }
  delete(id: number): boolean {
    if (!this.findById(id)) return false;
    // 级联删除所有子孙回复
    const toDel = new Set<number>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of this.comments) {
        if (c.parentId !== null && toDel.has(c.parentId) && !toDel.has(c.id)) {
          toDel.add(c.id); changed = true;
        }
      }
    }
    this.comments = this.comments.filter((c) => !toDel.has(c.id));
    return true;
  }
}

// 服务层：构建评论树
class CommentService {
  constructor(private repo: CommentRepository) {}
  create(data: any) {
    if (!data.targetId || !data.userId || !data.content) throw new Error('参数缺失: targetId/userId/content');
    return this.repo.create(data);
  }
  reply(id: number, data: any) {
    const parent = this.repo.findById(id);
    if (!parent) return null;
    if (!data.userId || !data.content) throw new Error('参数缺失: userId/content');
    return this.repo.create({ targetId: parent.targetId, userId: data.userId, content: data.content, parentId: id });
  }
  tree(targetId: string) {
    const list = this.repo.findByTarget(targetId);
    const map = new Map<number, any>();
    const roots: any[] = [];
    list.forEach((c) => map.set(c.id, { ...c, replies: [] }));
    list.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parentId === null || !map.has(c.parentId)) roots.push(node);
      else map.get(c.parentId)!.replies.push(node);
    });
    return roots;
  }
  like(id: number) { return this.repo.like(id); }
  delete(id: number) { return this.repo.delete(id); }
}

const repo = new CommentRepository();
const service = new CommentService(repo);

// POST /api/comments - 发表评论
router.post('/api/comments', (ctx) => {
  try { ctx.status = 201; ctx.body = service.create(ctx.request.body || {}); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// GET /api/comments?targetId= - 某目标的评论树（含 replies）
router.get('/api/comments', (ctx) => {
  const targetId = ctx.query.targetId as string;
  if (!targetId) { ctx.status = 400; ctx.body = { message: 'targetId 必填' }; return; }
  ctx.body = service.tree(targetId);
});
// POST /api/comments/:id/reply - 回复评论
router.post('/api/comments/:id/reply', (ctx) => {
  try {
    const c = service.reply(Number(ctx.params.id), ctx.request.body || {});
    if (!c) { ctx.status = 404; ctx.body = { message: '评论不存在' }; return; }
    ctx.status = 201; ctx.body = c;
  } catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// POST /api/comments/:id/like - 点赞
router.post('/api/comments/:id/like', (ctx) => {
  const c = service.like(Number(ctx.params.id));
  if (!c) { ctx.status = 404; ctx.body = { message: '评论不存在' }; return; }
  ctx.body = c;
});
// DELETE /api/comments/:id - 删除评论（含子孙回复）
router.delete('/api/comments/:id', (ctx) => {
  if (!service.delete(Number(ctx.params.id))) { ctx.status = 404; ctx.body = { message: '评论不存在' }; return; }
  ctx.status = 204;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[评论互动系统] running at http://localhost:' + PORT));
