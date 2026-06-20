import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 权限控制平台
 * 权限点管理、角色授权、权限校验中间件
 */

interface Permission {
  id: number;
  code: string;
  name: string;
}
interface Role {
  id: number;
  name: string;
  permissions: number[];
}

// ---- Repository 层 ----
class PermissionRepository {
  private perms: Permission[] = [
    { id: 1, code: 'user:read', name: '查看用户' },
    { id: 2, code: 'user:write', name: '编辑用户' },
    { id: 3, code: 'order:read', name: '查看订单' },
  ];
  private roles: Role[] = [
    { id: 1, name: 'admin', permissions: [1, 2, 3] },
    { id: 2, name: 'viewer', permissions: [1, 3] },
  ];
  // 当前模拟请求的角色 id（演示用）
  currentRoleId = 2;
  listPerms() {
    return this.perms;
  }
  createPerm(code: string, name: string) {
    const p: Permission = { id: Date.now(), code, name };
    this.perms.push(p);
    return p;
  }
  findRole(id: number) {
    return this.roles.find((r) => r.id === id);
  }
  assignPermissions(roleId: number, permIds: number[]) {
    const r = this.findRole(roleId);
    if (!r) return null;
    r.permissions = Array.from(new Set([...r.permissions, ...permIds]));
    return r;
  }
  hasPermission(permCode: string) {
    const role = this.findRole(this.currentRoleId);
    if (!role) return false;
    return role.permissions.some((pid) => {
      const p = this.perms.find((x) => x.id === pid);
      return p && p.code === permCode;
    });
  }
}

// ---- Service 层 ----
class PermissionService {
  constructor(private repo: PermissionRepository) {}
  list() {
    return this.repo.listPerms();
  }
  create(code: string, name: string) {
    if (!code || !name) throw new Error('code 和 name 必填');
    return this.repo.createPerm(code, name);
  }
  assign(roleId: number, permIds: number[]) {
    const r = this.repo.assignPermissions(roleId, permIds);
    if (!r) throw new Error('角色不存在');
    return r;
  }
  check(permCode: string) {
    return this.repo.hasPermission(permCode);
  }
}

// ---- 装配与中间件 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new PermissionService(new PermissionRepository());

// requirePermission 中间件工厂
const requirePermission = (code: string) => {
  return async (ctx: Koa.Context, next: Koa.Next) => {
    if (!service.check(code)) {
      ctx.status = 403;
      ctx.body = { message: `无权限: ${code}` };
      return;
    }
    await next();
  };
};

// GET /api/permissions - 权限列表
router.get('/api/permissions', (ctx) => {
  ctx.body = service.list();
});

// POST /api/permissions - 创建权限
router.post('/api/permissions', (ctx) => {
  try {
    const { code, name } = (ctx.request.body as any) || {};
    ctx.status = 201;
    ctx.body = service.create(code, name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// POST /api/roles/:id/permissions - 给角色授权
router.post('/api/roles/:id/permissions', (ctx) => {
  try {
    const { permissionIds } = (ctx.request.body as any) || {};
    if (!Array.isArray(permissionIds)) {
      ctx.status = 400;
      ctx.body = { message: 'permissionIds 必须为数组' };
      return;
    }
    ctx.body = service.assign(Number(ctx.params.id), permissionIds);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/check - 权限校验演示（需要 user:write 权限）
router.get('/api/check', requirePermission('user:write'), (ctx) => {
  ctx.body = { message: '权限校验通过', permission: 'user:write' };
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[权限控制平台] running at http://localhost:' + PORT);
});
