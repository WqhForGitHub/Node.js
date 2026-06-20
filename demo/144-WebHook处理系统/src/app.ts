import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * WebHook处理系统
 * webhook 注册 + 触发 + 重试，投递可随机失败，支持手动重试 failed 投递
 */
// ---- 类型定义 ----
interface Webhook {
  id: number;
  url: string;
  events: string[];
  createdAt: number;
}
interface Delivery {
  id: number;
  webhookId: number;
  event: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed';
  retries: number;
  createdAt: number;
}
// ---- Repository 层 ----
class WebhookRepository {
  private list: Webhook[] = [];
  private seq = 1;
  create(url: string, events: string[]) {
    const w: Webhook = { id: this.seq++, url, events, createdAt: Date.now() };
    this.list.push(w);
    return w;
  }
  findAll() {
    return this.list;
  }
  findById(id: number) {
    return this.list.find((w) => w.id === id);
  }
  delete(id: number) {
    const idx = this.list.findIndex((w) => w.id === id);
    if (idx < 0) return false;
    this.list.splice(idx, 1);
    return true;
  }
  findByEvent(event: string) {
    return this.list.filter((w) => w.events.includes(event));
  }
}
class DeliveryRepository {
  private list: Delivery[] = [];
  private seq = 1;
  create(webhookId: number, event: string, payload: any) {
    const d: Delivery = {
      id: this.seq++,
      webhookId,
      event,
      payload,
      status: 'pending',
      retries: 0,
      createdAt: Date.now(),
    };
    this.list.push(d);
    return d;
  }
  findById(id: number) {
    return this.list.find((d) => d.id === id);
  }
  findByWebhook(webhookId: number) {
    return this.list.filter((d) => d.webhookId === webhookId);
  }
}
// ---- Service 层 ----
class WebhookService {
  constructor(
    private webhooks: WebhookRepository,
    private deliveries: DeliveryRepository,
  ) {}
  register(url: string, events: string[]) {
    if (!url || !events || !events.length) throw new Error('参数缺失: url, events');
    return this.webhooks.create(url, events);
  }
  list() {
    return this.webhooks.findAll();
  }
  remove(id: number) {
    if (!this.webhooks.delete(id)) throw new Error('webhook 不存在');
    return { success: true };
  }
  // 触发：找到订阅该 event 的 webhook 创建投递任务，mock 投递可随机失败
  trigger(event: string, payload: any) {
    if (!event) throw new Error('参数缺失: event');
    const targets = this.webhooks.findByEvent(event);
    const deliveries: Delivery[] = [];
    for (const w of targets) {
      const d = this.deliveries.create(w.id, event, payload);
      // mock 投递：50% 概率失败
      const ok = Math.random() > 0.5;
      d.status = ok ? 'delivered' : 'failed';
      deliveries.push(d);
    }
    return { matched: targets.length, deliveries };
  }
  deliveriesOf(webhookId: number) {
    return this.deliveries.findByWebhook(webhookId);
  }
  retry(deliveryId: number) {
    const d = this.deliveries.findById(deliveryId);
    if (!d) throw new Error('delivery 不存在');
    if (d.status !== 'failed') throw new Error('仅 failed 投递可重试');
    d.retries++;
    // mock 重试：70% 成功
    d.status = Math.random() > 0.3 ? 'delivered' : 'failed';
    return d;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new WebhookService(new WebhookRepository(), new DeliveryRepository());

// POST /api/webhooks - 注册 webhook
router.post('/api/webhooks', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.register(b.url, b.events);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/webhooks - webhook 列表
router.get('/api/webhooks', (ctx) => {
  ctx.body = service.list();
});
// DELETE /api/webhooks/:id - 删除 webhook
router.delete('/api/webhooks/:id', (ctx) => {
  try {
    ctx.body = service.remove(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});
// POST /api/webhooks/trigger - 触发 webhook
router.post('/api/webhooks/trigger', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.trigger(b.event, b.payload);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/webhooks/:id/deliveries - 投递记录
router.get('/api/webhooks/:id/deliveries', (ctx) => {
  ctx.body = service.deliveriesOf(Number(ctx.params.id));
});
// POST /api/deliveries/:id/retry - 手动重试 failed 投递
router.post('/api/deliveries/:id/retry', (ctx) => {
  try {
    ctx.body = service.retry(Number(ctx.params.id));
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[WebHook处理系统] running at http://localhost:' + PORT);
});
