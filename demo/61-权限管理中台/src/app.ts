import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 权限管理中台
 * RBAC 权限中台
 * RBAC: 用户 - 角色 - 权限
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// 权限
const permissions = ['user:read', 'user:write', 'order:read', 'order:write'];
// 角色 -> 权限
const roles: Record<string, string[]> = {
  viewer: ['user:read', 'order:read'],
  editor: ['user:read', 'user:write', 'order:read'],
  admin: permissions,
};
// 用户 -> 角色
const users = [
  { id: 1, name: 'alice', roles: ['admin'] },
  { id: 2, name: 'bob', roles: ['editor'] },
  { id: 3, name: 'carol', roles: ['viewer'] },
];

function requirePerm(...perms: string[]) {
  return async (ctx: Koa.Context, next: Koa.Next) => {
    const userId = Number(ctx.header['x-user-id'] || 0);
    const u = users.find((x) => x.id === userId);
    if (!u) {
      ctx.status = 401;
      ctx.body = { message: '用户不存在' };
      return;
    }
    const userPerms = new Set(u.roles.flatMap((r) => roles[r] || []));
    if (!perms.every((p) => userPerms.has(p))) {
      ctx.status = 403;
      ctx.body = { message: '权限不足' };
      return;
    }
    ctx.state.user = u;
    await next();
  };
}

router.get('/users', requirePerm('user:read'), (ctx) => {
  ctx.body = users.map((u) => ({ id: u.id, name: u.name, roles: u.roles }));
});
router.post('/users', requirePerm('user:write'), (ctx) => {
  ctx.status = 201;
  ctx.body = { message: '用户已创建' };
});
router.get('/orders', requirePerm('order:read'), (ctx) => {
  ctx.body = [{ id: 1, amount: 100 }];
});
router.post('/orders', requirePerm('order:write'), (ctx) => {
  ctx.status = 201;
  ctx.body = { message: '订单已创建' };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[权限管理中台] running'));
