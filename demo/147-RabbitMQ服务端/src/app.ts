import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * RabbitMQ服务端
 * exchange + queue + binding（mock），实现 direct/topic（* 和 # 通配符）/fanout 三种路由
 */
// ---- 类型定义 ----
type ExchangeType = 'direct' | 'topic' | 'fanout';
interface Exchange {
  name: string;
  type: ExchangeType;
  bindings: { queue: string; routingKey: string }[];
  createdAt: number;
}
interface Queue {
  name: string;
  messages: { routingKey: string; payload: any; deliveredAt: number }[];
  createdAt: number;
}
// ---- Repository 层 ----
class ExchangeRepository {
  private map: Map<string, Exchange> = new Map();
  create(name: string, type: ExchangeType) {
    if (!name) throw new Error('参数缺失: name');
    if (!['direct', 'topic', 'fanout'].includes(type)) throw new Error('exchange type 非法');
    if (this.map.has(name)) throw new Error('exchange 已存在');
    const ex: Exchange = { name, type, bindings: [], createdAt: Date.now() };
    this.map.set(name, ex);
    return ex;
  }
  find(name: string) {
    return this.map.get(name);
  }
  bind(exchangeName: string, queue: string, routingKey: string) {
    const ex = this.map.get(exchangeName);
    if (!ex) throw new Error('exchange 不存在');
    ex.bindings.push({ queue, routingKey });
    return ex.bindings;
  }
}
class QueueRepository {
  private map: Map<string, Queue> = new Map();
  create(name: string) {
    if (!name) throw new Error('参数缺失: name');
    if (this.map.has(name)) throw new Error('queue 已存在');
    const q: Queue = { name, messages: [], createdAt: Date.now() };
    this.map.set(name, q);
    return q;
  }
  find(name: string) {
    return this.map.get(name);
  }
  push(name: string, routingKey: string, payload: any) {
    const q = this.map.get(name);
    if (!q) throw new Error('queue 不存在');
    q.messages.push({ routingKey, payload, deliveredAt: Date.now() });
  }
  // FIFO 消费
  consume(name: string) {
    const q = this.map.get(name);
    if (!q) throw new Error('queue 不存在');
    return q.messages.shift();
  }
  count(name: string) {
    const q = this.map.get(name);
    if (!q) throw new Error('queue 不存在');
    return q.messages.length;
  }
}
// ---- Service 层 ----
class AMQPService {
  constructor(private exchanges: ExchangeRepository, private queues: QueueRepository) {}
  createExchange(name: string, type: ExchangeType) {
    return this.exchanges.create(name, type);
  }
  createQueue(name: string) {
    return this.queues.create(name);
  }
  bind(exchangeName: string, queue: string, routingKey: string) {
    if (!this.queues.find(queue)) throw new Error('queue 不存在');
    return this.exchanges.bind(exchangeName, queue, routingKey);
  }
  // 发布消息：按 exchange 类型路由到匹配 queue
  publish(exchangeName: string, routingKey: string, payload: any) {
    const ex = this.exchanges.find(exchangeName);
    if (!ex) throw new Error('exchange 不存在');
    const targetQueues = new Set<string>();
    if (ex.type === 'fanout') {
      // 广播到所有绑定的 queue
      for (const b of ex.bindings) targetQueues.add(b.queue);
    } else if (ex.type === 'direct') {
      // 精确匹配 routingKey
      for (const b of ex.bindings) {
        if (b.routingKey === routingKey) targetQueues.add(b.queue);
      }
    } else if (ex.type === 'topic') {
      // 通配符匹配：* 匹配一个单词，# 匹配零或多个单词
      for (const b of ex.bindings) {
        if (this.topicMatch(b.routingKey, routingKey)) targetQueues.add(b.queue);
      }
    }
    for (const q of targetQueues) this.queues.push(q, routingKey, payload);
    return { matchedQueues: Array.from(targetQueues) };
  }
  // topic 通配符匹配
  private topicMatch(pattern: string, key: string): boolean {
    const patternParts = pattern.split('.');
    const keyParts = key.split('.');
    let pi = 0;
    let ki = 0;
    while (pi < patternParts.length && ki < keyParts.length) {
      const p = patternParts[pi];
      if (p === '#') {
        // # 匹配零或多个单词
        if (pi === patternParts.length - 1) return true;
        // 尝试后续匹配
        const nextP = patternParts[pi + 1];
        while (ki < keyParts.length && keyParts[ki] !== nextP) ki++;
        pi++;
      } else if (p === '*') {
        pi++;
        ki++;
      } else {
        if (p !== keyParts[ki]) return false;
        pi++;
        ki++;
      }
    }
    if (pi < patternParts.length && patternParts[pi] === '#') pi++;
    return pi === patternParts.length && ki === keyParts.length;
  }
  consume(queue: string) {
    const msg = this.queues.consume(queue);
    if (!msg) return null;
    return msg;
  }
  queueInfo(queue: string) {
    return { name: queue, messages: this.queues.count(queue) };
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new AMQPService(new ExchangeRepository(), new QueueRepository());

// POST /api/exchanges - 创建 exchange
router.post('/api/exchanges', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.createExchange(b.name, b.type);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/queues - 创建 queue
router.post('/api/queues', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.createQueue(b.name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/bindings - 绑定
router.post('/api/bindings', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.bind(b.exchange, b.queue, b.routingKey);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/exchanges/:name/publish - 发布消息
router.post('/api/exchanges/:name/publish', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.publish(ctx.params.name, b.routingKey, b.payload);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/queues/:name/consume - 从 queue 消费
router.post('/api/queues/:name/consume', (ctx) => {
  try {
    const msg = service.consume(ctx.params.name);
    if (!msg) {
      ctx.status = 204;
      ctx.body = { message: 'queue 为空' };
      return;
    }
    ctx.body = msg;
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});
// GET /api/queues/:name - 队列消息数
router.get('/api/queues/:name', (ctx) => {
  try {
    ctx.body = service.queueInfo(ctx.params.name);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[RabbitMQ服务端] running at http://localhost:' + PORT);
});
