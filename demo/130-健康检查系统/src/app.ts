import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 健康检查系统
 * liveness / readiness 探针 + 依赖组件检查与故障模拟
 */
type ComponentStatus = 'up' | 'down' | 'degraded';
interface Component {
  name: string;
  status: ComponentStatus;
  detail: string;
  lastChangedAt: number;
}
// ---- Repository 层 ----
class HealthRepository {
  private components: Component[] = [
    { name: 'db', status: 'up', detail: '数据库连接正常', lastChangedAt: Date.now() },
    { name: 'cache', status: 'up', detail: '缓存连接正常', lastChangedAt: Date.now() },
    { name: 'queue', status: 'up', detail: '消息队列连接正常', lastChangedAt: Date.now() },
  ];
  list() { return this.components.slice(); }
  find(name: string) { return this.components.find((c) => c.name === name); }
  toggle(name: string) {
    const c = this.find(name);
    if (!c) return undefined;
    // up -> down -> degraded -> up 循环
    c.status = c.status === 'up' ? 'down' : c.status === 'down' ? 'degraded' : 'up';
    c.detail = c.status === 'up' ? '组件已恢复' : c.status === 'down' ? '组件故障（手动模拟）' : '组件降级（手动模拟）';
    c.lastChangedAt = Date.now();
    return c;
  }
  // readiness: 任一关键组件 down 则不可用
  isReady() {
    return !this.components.some((c) => c.status === 'down');
  }
}
// ---- Service 层 ----
class HealthService {
  constructor(private repo: HealthRepository) {}
  liveness() {
    return { status: 'ok', probe: 'liveness', timestamp: Date.now() };
  }
  readiness() {
    const ready = this.repo.isReady();
    return {
      status: ready ? 'ok' : 'not_ready',
      probe: 'readiness',
      timestamp: Date.now(),
      components: this.repo.list(),
    };
  }
  components() {
    return this.repo.list();
  }
  toggle(name: string) {
    const c = this.repo.toggle(name);
    if (!c) throw new Error('not found');
    return c;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new HealthService(new HealthRepository());

// liveness 探针
router.get('/health', (ctx) => {
  ctx.body = service.liveness();
});
// readiness 探针
router.get('/ready', (ctx) => {
  const r: any = service.readiness();
  if (r.status !== 'ok') ctx.status = 503;
  ctx.body = r;
});
// 组件健康详情
router.get('/api/health/components', (ctx) => {
  ctx.body = service.components();
});
// 切换组件状态（故障/恢复）
router.post('/api/health/components/:name/toggle', (ctx) => {
  try { ctx.body = service.toggle(ctx.params.name); }
  catch (e: any) { ctx.status = 404; ctx.body = { message: e.message }; }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[健康检查系统] running at http://localhost:' + PORT));
