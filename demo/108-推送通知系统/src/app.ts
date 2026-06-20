import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 推送通知系统
 * 设备 token 注册、推送
 */
type Platform = 'ios' | 'android' | 'web';
interface Device { id: number; userId: string; token: string; platform: Platform; }
interface PushRecord { id: number; userId: string; title: string; body: string; status: 'queued' | 'sent' | 'failed'; createdAt: number; }

// ---- Repository 层 ----
class PushRepository {
  private devices: Device[] = [];
  private records: PushRecord[] = [];
  register(d: Device) {
    const idx = this.devices.findIndex((x) => x.token === d.token);
    if (idx >= 0) this.devices[idx] = d; else this.devices.push(d);
    return d;
  }
  unregister(token: string) {
    const idx = this.devices.findIndex((d) => d.token === token);
    if (idx < 0) return null;
    return this.devices.splice(idx, 1)[0];
  }
  findByUser(userId: string) { return this.devices.filter((d) => d.userId === userId); }
  addRecord(r: PushRecord) { this.records.push(r); return r; }
  listRecords() { return this.records; }
}
// ---- Service 层 ----
class PushService {
  constructor(private repo: PushRepository) {}
  register(userId: string, token: string, platform: string) {
    if (!userId || !token || !platform) throw new Error('参数缺失: userId/token/platform');
    if (!['ios', 'android', 'web'].includes(platform)) throw new Error('非法 platform: ' + platform);
    return this.repo.register({ id: Date.now() + Math.floor(Math.random() * 1000), userId, token, platform: platform as Platform });
  }
  unregister(token: string) {
    const d = this.repo.unregister(token);
    if (!d) throw new Error('设备不存在');
    return d;
  }
  push(userId: string, title: string, body: string) {
    if (!userId || !title || !body) throw new Error('参数缺失: userId/title/body');
    const devices = this.repo.findByUser(userId);
    if (!devices.length) throw new Error('用户无可用设备');
    // 按 platform 分组
    const byPlatform: Record<string, number> = {};
    devices.forEach((d) => { byPlatform[d.platform] = (byPlatform[d.platform] || 0) + 1; });
    const record = this.repo.addRecord({ id: Date.now() + Math.floor(Math.random() * 1000), userId, title, body, status: 'sent', createdAt: Date.now() });
    return { record, platformStats: byPlatform };
  }
  listRecords() { return this.repo.listRecords(); }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new PushService(new PushRepository());

router.post('/api/devices', (ctx) => {
  try {
    const { userId, token, platform } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.register(userId, token, platform);
  } catch (e) { ctx.status = 400; ctx.body = { message: (e as Error).message }; }
});
router.delete('/api/devices/:token', (ctx) => {
  try { ctx.body = service.unregister(ctx.params.token); }
  catch (e) { ctx.status = 404; ctx.body = { message: (e as Error).message }; }
});
router.post('/api/push', (ctx) => {
  try {
    const { userId, title, body } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.push(userId, title, body);
  } catch (e) { const m = (e as Error).message; ctx.status = m === '用户无可用设备' ? 404 : 400; ctx.body = { message: m }; }
});
router.get('/api/push/records', (ctx) => { ctx.body = service.listRecords(); });

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[推送通知系统] running at http://localhost:' + PORT);
});
