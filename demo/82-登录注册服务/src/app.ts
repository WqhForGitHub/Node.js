import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 登录注册服务
 * 注册、登录、token 生成（简单 base64）与 token 校验中间件
 */

interface Account {
  id: number;
  username: string;
  password: string;
  token: string;
}

// ---- Repository 层 ----
class AccountRepository {
  private accounts: Account[] = [];
  findByUsername(username: string) {
    return this.accounts.find((a) => a.username === username);
  }
  findByToken(token: string) {
    return this.accounts.find((a) => a.token === token);
  }
  create(data: Account) {
    this.accounts.push(data);
    return data;
  }
  updateToken(id: number, token: string) {
    const a = this.accounts.find((x) => x.id === id);
    if (a) a.token = token;
    return a;
  }
}

// ---- Service 层 ----
class AuthService {
  constructor(private repo: AccountRepository) {}
  register(username: string, password: string) {
    if (!username || !password) throw new Error('用户名和密码必填');
    if (this.repo.findByUsername(username)) throw new Error('用户名已存在');
    const account: Account = {
      id: Date.now(),
      username,
      password,
      token: '',
    };
    return this.repo.create(account);
  }
  login(username: string, password: string) {
    const a = this.repo.findByUsername(username);
    if (!a || a.password !== password) throw new Error('用户名或密码错误');
    // 简单 base64 token，非真 JWT
    a.token = Buffer.from(`${a.id}:${a.username}:${Date.now()}`).toString('base64');
    this.repo.updateToken(a.id, a.token);
    return a;
  }
  profile(token: string) {
    return this.repo.findByToken(token);
  }
}

// ---- 装配与中间件 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new AuthService(new AccountRepository());

// token 校验中间件
const auth = async (ctx: Koa.Context, next: Koa.Next) => {
  const authHeader = ctx.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const account = service.profile(token);
  if (!account) {
    ctx.status = 401;
    ctx.body = { message: '未登录或 token 无效' };
    return;
  }
  (ctx as any).user = account;
  await next();
};

// POST /api/register - 注册
router.post('/api/register', (ctx) => {
  try {
    const { username, password } = (ctx.request.body as any) || {};
    const a = service.register(username, password);
    ctx.status = 201;
    ctx.body = { id: a.id, username: a.username };
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// POST /api/login - 登录
router.post('/api/login', (ctx) => {
  try {
    const { username, password } = (ctx.request.body as any) || {};
    const a = service.login(username, password);
    ctx.body = { id: a.id, username: a.username, token: a.token };
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/profile - 当前用户（需 token）
router.get('/api/profile', auth, (ctx) => {
  const u = (ctx as any).user as Account;
  ctx.body = { id: u.id, username: u.username };
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[登录注册服务] running at http://localhost:' + PORT);
});
