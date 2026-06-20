import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 用户管理系统
 * 用户的增删改查与关键字搜索
 */

interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  status: 'active' | 'disabled';
  createdAt: string;
}

// ---- Repository 层 ----
class UserRepository {
  private users: User[] = [
    { id: 1, username: 'admin', email: 'admin@demo.com', phone: '13800000000', status: 'active', createdAt: '2024-01-01' },
    { id: 2, username: 'tester', email: 'test@demo.com', phone: '13900000000', status: 'active', createdAt: '2024-02-01' },
  ];
  findAll(keyword?: string) {
    if (!keyword) return this.users;
    const k = keyword.toLowerCase();
    return this.users.filter(
      (u) =>
        u.username.toLowerCase().includes(k) ||
        u.email.toLowerCase().includes(k) ||
        u.phone.includes(k)
    );
  }
  findById(id: number) {
    return this.users.find((u) => u.id === id);
  }
  create(data: Partial<User>) {
    const u: User = {
      id: Date.now(),
      username: data.username || '',
      email: data.email || '',
      phone: data.phone || '',
      status: data.status || 'active',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    this.users.push(u);
    return u;
  }
  update(id: number, data: Partial<User>) {
    const u = this.findById(id);
    if (!u) return null;
    Object.assign(u, data, { id: u.id });
    return u;
  }
  delete(id: number) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }
}

// ---- Service 层 ----
class UserService {
  constructor(private repo: UserRepository) {}
  list(keyword?: string) {
    return this.repo.findAll(keyword);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  create(data: Partial<User>) {
    if (!data.username) throw new Error('username 必填');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<User>) {
    return this.repo.update(id, data);
  }
  delete(id: number) {
    return this.repo.delete(id);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new UserService(new UserRepository());

// GET /api/users - 列表，支持 keyword 搜索
router.get('/api/users', (ctx) => {
  const keyword = (ctx.query.keyword as string) || '';
  ctx.body = service.list(keyword);
});

// GET /api/users/:id - 详情
router.get('/api/users/:id', (ctx) => {
  const u = service.get(Number(ctx.params.id));
  if (!u) {
    ctx.status = 404;
    ctx.body = { message: '用户不存在' };
    return;
  }
  ctx.body = u;
});

// POST /api/users - 创建
router.post('/api/users', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// PUT /api/users/:id - 更新
router.put('/api/users/:id', (ctx) => {
  const u = service.update(Number(ctx.params.id), ctx.request.body || {});
  if (!u) {
    ctx.status = 404;
    ctx.body = { message: '用户不存在' };
    return;
  }
  ctx.body = u;
});

// DELETE /api/users/:id - 删除
router.delete('/api/users/:id', (ctx) => {
  const ok = service.delete(Number(ctx.params.id));
  if (!ok) {
    ctx.status = 404;
    ctx.body = { message: '用户不存在' };
    return;
  }
  ctx.status = 204;
  ctx.body = null;
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[用户管理系统] running at http://localhost:' + PORT);
});
