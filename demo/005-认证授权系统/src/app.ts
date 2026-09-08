import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 认证授权系统
 * 登录签发 Token 认证
 * 认证: 登录签发 token + 中间件校验
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

const SECRET = 'demo-secret';
const users = [{ id: 1, username: 'admin', password: hash('123456') }];
const tokens = new Set();

function hash(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function sign(payload: any) {
  return (
    Buffer.from(JSON.stringify(payload)).toString('base64') +
    '.' +
    hash(JSON.stringify(payload) + SECRET).slice(0, 16)
  );
}
function verify(token: string) {
  const [data, sig] = token.split('.');
  if (hash(Buffer.from(data, 'base64').toString() + SECRET).slice(0, 16) !== sig) return null;
  return JSON.parse(Buffer.from(data, 'base64').toString());
}

router.post('/login', (ctx) => {
  const { username, password } = (ctx.request.body || {}) as { username: string; password: string };
  const u = users.find((x) => x.username === username && x.password === hash(password));
  if (!u) {
    ctx.status = 401;
    ctx.body = { message: '用户名或密码错误' };
    return;
  }
  const token = sign({ id: u.id, username: u.username });
  tokens.add(token);
  ctx.body = { token };
});

// 认证中间件
const authRequired = async (ctx: Koa.Context, next: Koa.Next) => {
  const token = (ctx.header.authorization || '').replace('Bearer ', '');
  const payload = token && verify(token);
  if (!payload || !tokens.has(token)) {
    ctx.status = 401;
    ctx.body = { message: '未授权' };
    return;
  }
  ctx.state.user = payload;
  await next();
};

router.get('/profile', authRequired, (ctx) => {
  ctx.body = ctx.state.user;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[认证授权系统] running'));
