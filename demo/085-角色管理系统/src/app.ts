import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 角色管理系统
 * 角色 CRUD 与用户角色分配
 */

interface Role {
  id: number;
  name: string;
  description: string;
}
interface User {
  id: number;
  username: string;
  roleId: number | null;
}

// ---- Repository 层 ----
class RoleRepository {
  private roles: Role[] = [
    { id: 1, name: 'admin', description: '超级管理员' },
    { id: 2, name: 'editor', description: '编辑' },
  ];
  private users: User[] = [
    { id: 1, username: 'alice', roleId: 1 },
    { id: 2, username: 'bob', roleId: null },
  ];
  listRoles() {
    return this.roles;
  }
  findRole(id: number) {
    return this.roles.find((r) => r.id === id);
  }
  create(name: string, description: string) {
    const r: Role = { id: Date.now(), name, description };
    this.roles.push(r);
    return r;
  }
  update(id: number, data: Partial<Role>) {
    const r = this.findRole(id);
    if (!r) return null;
    Object.assign(r, data, { id: r.id });
    return r;
  }
  delete(id: number) {
    const idx = this.roles.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.roles.splice(idx, 1);
    // 解除已分配该角色的用户
    this.users.forEach((u) => {
      if (u.roleId === id) u.roleId = null;
    });
    return true;
  }
  findUser(userId: number) {
    return this.users.find((u) => u.id === userId);
  }
  assignRole(userId: number, roleId: number) {
    const u = this.findUser(userId);
    if (!u) return null;
    u.roleId = roleId;
    return u;
  }
}

// ---- Service 层 ----
class RoleService {
  constructor(private repo: RoleRepository) {}
  list() {
    return this.repo.listRoles();
  }
  create(name: string, description: string) {
    if (!name) throw new Error('角色名必填');
    return this.repo.create(name, description || '');
  }
  update(id: number, data: Partial<Role>) {
    const r = this.repo.update(id, data);
    if (!r) throw new Error('角色不存在');
    return r;
  }
  delete(id: number) {
    if (!this.repo.delete(id)) throw new Error('角色不存在');
    return true;
  }
  assignRole(userId: number, roleId: number) {
    if (!this.repo.findRole(roleId)) throw new Error('角色不存在');
    const u = this.repo.assignRole(userId, roleId);
    if (!u) throw new Error('用户不存在');
    return u;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new RoleService(new RoleRepository());

// GET /api/roles - 角色列表
router.get('/api/roles', (ctx) => {
  ctx.body = service.list();
});

// POST /api/roles - 创建角色
router.post('/api/roles', (ctx) => {
  try {
    const { name, description } = (ctx.request.body as any) || {};
    ctx.status = 201;
    ctx.body = service.create(name, description);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// PUT /api/roles/:id - 更新角色
router.put('/api/roles/:id', (ctx) => {
  try {
    ctx.body = service.update(Number(ctx.params.id), (ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// DELETE /api/roles/:id - 删除角色
router.delete('/api/roles/:id', (ctx) => {
  try {
    service.delete(Number(ctx.params.id));
    ctx.status = 204;
    ctx.body = null;
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

// POST /api/users/:userId/role - 给用户分配角色
router.post('/api/users/:userId/role', (ctx) => {
  try {
    const { roleId } = (ctx.request.body as any) || {};
    ctx.body = service.assignRole(Number(ctx.params.userId), Number(roleId));
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[角色管理系统] running at http://localhost:' + PORT);
});
