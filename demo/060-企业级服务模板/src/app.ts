import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 企业级服务模板
 * 企业级脚手架分层
 * 分层架构: routes -> controller -> service -> repository
 */
// ---- Repository 层 ----
class UserRepository {
  private users: any[] = [{ id: 1, name: 'admin', role: 'admin' }];
  findAll() {
    return this.users;
  }
  findById(id: number) {
    return this.users.find((u) => u.id === id);
  }
  create(data: any) {
    const u = { id: Date.now(), ...data };
    this.users.push(u);
    return u;
  }
}
// ---- Service 层 ----
class UserService {
  constructor(private repo: UserRepository) {}
  list() {
    return this.repo.findAll();
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  create(data: any) {
    return this.repo.create(data);
  }
}
// ---- Controller 层 ----
class UserController {
  constructor(private service: UserService) {}
  async list(ctx: Koa.Context) {
    ctx.body = this.service.list();
  }
  async get(ctx: Koa.Context) {
    const u = this.service.get(Number(ctx.params.id));
    if (!u) {
      ctx.status = 404;
      ctx.body = { message: 'not found' };
      return;
    }
    ctx.body = u;
  }
  async create(ctx: Koa.Context) {
    ctx.status = 201;
    ctx.body = this.service.create(ctx.request.body || {});
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const repo = new UserRepository();
const service = new UserService(repo);
const controller = new UserController(service);

router.get('/users', controller.list.bind(controller));
router.get('/users/:id', controller.get.bind(controller));
router.post('/users', controller.create.bind(controller));

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[企业级服务模板] running'));
