import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 事件驱动系统
 * 事件总线 + 订阅（mock 投递），支持 topic 创建、订阅、发布与投递记录查询
 */
// ---- 类型定义 ----
interface Topic {
  name: string;
  createdAt: number;
}
interface Subscription {
  id: number;
  topicName: string;
  subscriberUrl: string;
  createdAt: number;
}
interface Event {
  id: number;
  topicName: string;
  payload: any;
  createdAt: number;
}
interface Delivery {
  id: number;
  subscriptionId: number;
  eventId: number;
  topicName: string;
  status: 'delivered' | 'failed';
  createdAt: number;
}
// ---- EventBus 类 ----
class EventBus {
  private topics: Map<string, Topic> = new Map();
  private subscriptions: Subscription[] = [];
  private events: Event[] = [];
  private deliveries: Delivery[] = [];
  private subSeq = 1;
  private eventSeq = 1;
  private deliverySeq = 1;
  // on - 创建 topic / 订阅
  createTopic(name: string) {
    if (!name) throw new Error('参数缺失: name');
    if (this.topics.has(name)) throw new Error('topic 已存在');
    const t: Topic = { name, createdAt: Date.now() };
    this.topics.set(name, t);
    return t;
  }
  subscribe(topicName: string, subscriberUrl: string) {
    if (!subscriberUrl) throw new Error('参数缺失: subscriberUrl');
    if (!this.topics.has(topicName)) throw new Error('topic 不存在');
    const sub: Subscription = { id: this.subSeq++, topicName, subscriberUrl, createdAt: Date.now() };
    this.subscriptions.push(sub);
    return sub;
  }
  off(subscriptionId: number) {
    const idx = this.subscriptions.findIndex((s) => s.id === subscriptionId);
    if (idx < 0) throw new Error('subscription 不存在');
    const removed = this.subscriptions.splice(idx, 1)[0];
    return removed;
  }
  // emit - 发布事件，遍历订阅者记录投递
  publish(topicName: string, payload: any) {
    if (!this.topics.has(topicName)) throw new Error('topic 不存在');
    const ev: Event = { id: this.eventSeq++, topicName, payload, createdAt: Date.now() };
    this.events.push(ev);
    const subs = this.subscriptions.filter((s) => s.topicName === topicName);
    const deliveries: Delivery[] = [];
    for (const s of subs) {
      // mock 投递：默认成功
      const d: Delivery = {
        id: this.deliverySeq++,
        subscriptionId: s.id,
        eventId: ev.id,
        topicName,
        status: 'delivered',
        createdAt: Date.now(),
      };
      this.deliveries.push(d);
      deliveries.push(d);
    }
    return { event: ev, deliveries };
  }
  eventsOf(topicName: string) {
    return this.events.filter((e) => e.topicName === topicName);
  }
  deliveriesOf(subscriptionId: number) {
    return this.deliveries.filter((d) => d.subscriptionId === subscriptionId);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const bus = new EventBus();

// POST /api/topics - 创建 topic
router.post('/api/topics', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = bus.createTopic(b.name);
  } catch (e: any) {
    ctx.status = e.message.includes('已存在') ? 400 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/topics/:name/subscribe - 订阅
router.post('/api/topics/:name/subscribe', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = bus.subscribe(ctx.params.name, b.subscriberUrl);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/topics/:name/publish - 发布事件
router.post('/api/topics/:name/publish', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = bus.publish(ctx.params.name, b.payload);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/topics/:name/events - 事件历史
router.get('/api/topics/:name/events', (ctx) => {
  ctx.body = bus.eventsOf(ctx.params.name);
});
// GET /api/subscriptions/:id/deliveries - 投递记录
router.get('/api/subscriptions/:id/deliveries', (ctx) => {
  ctx.body = bus.deliveriesOf(Number(ctx.params.id));
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[事件驱动系统] running at http://localhost:' + PORT);
});
