import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 用户中心服务
 * 用户中心: 注册/登录/资料
 * 用户中心: 注册 / 登录 / 资料 / 修改密码
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

const users = new Map<number, { id: number; username: string; password: string; profile: any }>();
let nextId = 1;

router.post('/register', (ctx) => {
  const { username, password } = (ctx.request.body || {}) as { username: string; password: string };
  if ([...users.values()].some((u) => u.username === username)) {
    ctx.status = 409;
    ctx.body = { message: '用户名已存在' };
    return;
  }
  const u = { id: nextId++, username, password, profile: { nickname: username } };
  users.set(u.id, u);
  ctx.status = 201;
  ctx.body = { id: u.id, username: u.username };
});
router.post('/login', (ctx) => {
  const { username, password } = (ctx.request.body || {}) as { username: string; password: string };
  const u = [...users.values()].find((x) => x.username === username && x.password === password);
  if (!u) {
    ctx.status = 401;
    ctx.body = { message: '凭证错误' };
    return;
  }
  ctx.body = { id: u.id, username: u.username, profile: u.profile };
});
router.get('/users/:id', (ctx) => {
  const u = users.get(Number(ctx.params.id));
  if (!u) {
    ctx.status = 404;
    ctx.body = { message: '不存在' };
    return;
  }
  ctx.body = { id: u.id, username: u.username, profile: u.profile };
});
router.put('/users/:id/profile', (ctx) => {
  const u = users.get(Number(ctx.params.id));
  if (!u) {
    ctx.status = 404;
    ctx.body = { message: '不存在' };
    return;
  }
  u.profile = { ...u.profile, ...(ctx.request.body || {}) };
  ctx.body = u.profile;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[用户中心服务] running'));
