import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 账号中心系统
 * 账号资料、绑定、密码、设置
 */

interface Account {
  id: number;
  username: string;
  password: string;
  phone: string;
  email: string;
  settings: Record<string, any>;
}

// ---- Repository 层 ----
class AccountRepository {
  private account: Account = {
    id: 1,
    username: 'current_user',
    password: '123456',
    phone: '',
    email: '',
    settings: { theme: 'light', notify: true, language: 'zh-CN' },
  };
  get() {
    return this.account;
  }
  save(data: Partial<Account>) {
    Object.assign(this.account, data, { id: this.account.id });
    return this.account;
  }
  bind(type: 'phone' | 'email', value: string) {
    if (type === 'phone') this.account.phone = value;
    else this.account.email = value;
    return this.account;
  }
  changePassword(newPwd: string) {
    this.account.password = newPwd;
    return this.account;
  }
  updateSettings(settings: Record<string, any>) {
    this.account.settings = { ...this.account.settings, ...settings };
    return this.account.settings;
  }
}

// ---- Service 层 ----
class AccountService {
  constructor(private repo: AccountRepository) {}
  getProfile() {
    const a = this.repo.get();
    const { password, ...rest } = a;
    return rest;
  }
  updateProfile(data: Partial<Pick<Account, 'username'>>) {
    if (!data.username) throw new Error('username 必填');
    this.repo.save({ username: data.username });
    return this.getProfile();
  }
  bind(type: 'phone' | 'email', value: string) {
    if (!['phone', 'email'].includes(type)) throw new Error('绑定类型非法');
    if (!value) throw new Error('绑定值必填');
    this.repo.bind(type, value);
    return this.getProfile();
  }
  changePassword(oldPwd: string, newPwd: string) {
    const a = this.repo.get();
    if (a.password !== oldPwd) throw new Error('原密码错误');
    if (!newPwd) throw new Error('新密码必填');
    this.repo.changePassword(newPwd);
    return true;
  }
  getSettings() {
    return this.repo.get().settings;
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new AccountService(new AccountRepository());

// GET /api/account/profile - 账号资料
router.get('/api/account/profile', (ctx) => {
  ctx.body = service.getProfile();
});

// PUT /api/account/profile - 更新资料
router.put('/api/account/profile', (ctx) => {
  try {
    ctx.body = service.updateProfile((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// POST /api/account/bind - 绑定手机/邮箱
router.post('/api/account/bind', (ctx) => {
  try {
    const { type, value } = (ctx.request.body as any) || {};
    ctx.body = service.bind(type, value);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// PUT /api/account/password - 修改密码
router.put('/api/account/password', (ctx) => {
  try {
    const { oldPassword, newPassword } = (ctx.request.body as any) || {};
    service.changePassword(oldPassword, newPassword);
    ctx.body = { message: '密码修改成功' };
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

// GET /api/account/settings - 账号设置
router.get('/api/account/settings', (ctx) => {
  ctx.body = service.getSettings();
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[账号中心系统] running at http://localhost:' + PORT);
});
