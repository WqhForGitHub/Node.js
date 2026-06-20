import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 消息队列服务
 * topic + 分区 + 消费者组（mock），支持 partition 路由（指定 partition 或按 key hash）
 */
// ---- 类型定义 ----
interface Topic {
  name: string;
  partitions: number;
  messages: { partition: number; offset: number; key: string | null; value: any }[];
  createdAt: number;
}
interface ConsumerGroup {
  groupName: string;
  topic: string;
  offsets: number[]; // 各 partition 的已提交 offset
  createdAt: number;
}
// ---- Repository 层 ----
class TopicRepository {
  private map: Map<string, Topic> = new Map();
  create(name: string, partitions: number) {
    if (!name) throw new Error('参数缺失: name');
    if (this.map.has(name)) throw new Error('topic 已存在');
    if (!partitions || partitions < 1) partitions = 1;
    const t: Topic = { name, partitions, messages: [], createdAt: Date.now() };
    this.map.set(name, t);
    return t;
  }
  find(name: string) {
    return this.map.get(name);
  }
  // 生产消息：指定 partition 或按 key hash
  produce(name: string, key: string | null, value: any, partition?: number) {
    const t = this.map.get(name);
    if (!t) throw new Error('topic 不存在');
    let p: number;
    if (partition !== undefined && partition !== null) {
      if (partition < 0 || partition >= t.partitions) throw new Error('partition 越界');
      p = partition;
    } else if (key) {
      // 按 key hash
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
      p = Math.abs(h) % t.partitions;
    } else {
      // 无 key 无 partition：轮询
      p = t.messages.length % t.partitions;
    }
    const partitionMessages = t.messages.filter((m) => m.partition === p);
    const offset = partitionMessages.length;
    const msg = { partition: p, offset, key, value };
    t.messages.push(msg);
    return msg;
  }
  // 各 partition 的 offset（消息数）
  offsets(name: string) {
    const t = this.map.get(name);
    if (!t) throw new Error('topic 不存在');
    const result: { partition: number; offset: number }[] = [];
    for (let i = 0; i < t.partitions; i++) {
      result.push({ partition: i, offset: t.messages.filter((m) => m.partition === i).length });
    }
    return result;
  }
}
class ConsumerGroupRepository {
  private map: Map<string, ConsumerGroup> = new Map();
  create(groupName: string, topic: string, partitions: number) {
    if (!groupName) throw new Error('参数缺失: groupName');
    if (this.map.has(groupName)) throw new Error('consumer group 已存在');
    const g: ConsumerGroup = { groupName, topic, offsets: new Array(partitions).fill(0), createdAt: Date.now() };
    this.map.set(groupName, g);
    return g;
  }
  find(groupName: string) {
    return this.map.get(groupName);
  }
  // 拉取消息：从各 partition 的当前 offset 开始拉取
  poll(g: ConsumerGroup, topic: Topic, max: number) {
    const result: any[] = [];
    for (let p = 0; p < topic.partitions; p++) {
      const start = g.offsets[p] || 0;
      const partMsgs = topic.messages.filter((m) => m.partition === p).slice(start, start + max);
      result.push(...partMsgs);
      g.offsets[p] = start + partMsgs.length;
    }
    return result;
  }
  // 提交 offset（覆盖）
  commit(g: ConsumerGroup, offsets: number[]) {
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] !== undefined) g.offsets[i] = offsets[i];
    }
    return g.offsets;
  }
}
// ---- Service 层 ----
class MQService {
  constructor(private topics: TopicRepository, private groups: ConsumerGroupRepository) {}
  createTopic(name: string, partitions: number) {
    return this.topics.create(name, partitions);
  }
  produce(name: string, body: any) {
    const t = this.topics.find(name);
    if (!t) throw new Error('topic 不存在');
    return this.topics.produce(name, body.key ?? null, body.value, body.partition);
  }
  registerConsumer(groupName: string, topicName: string) {
    const t = this.topics.find(topicName);
    if (!t) throw new Error('topic 不存在');
    return this.groups.create(groupName, topicName, t.partitions);
  }
  poll(groupName: string, max = 10) {
    const g = this.groups.find(groupName);
    if (!g) throw new Error('consumer group 不存在');
    const t = this.topics.find(g.topic);
    if (!t) throw new Error('topic 不存在');
    return this.groups.poll(g, t, max);
  }
  commit(groupName: string, offsets: number[]) {
    const g = this.groups.find(groupName);
    if (!g) throw new Error('consumer group 不存在');
    return this.groups.commit(g, offsets);
  }
  offsets(name: string) {
    return this.topics.offsets(name);
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new MQService(new TopicRepository(), new ConsumerGroupRepository());

// POST /api/topics - 创建 topic
router.post('/api/topics', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.createTopic(b.name, Number(b.partitions));
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/topics/:name/produce - 生产消息
router.post('/api/topics/:name/produce', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.produce(ctx.params.name, ctx.request.body || {});
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/consumers - 注册消费者组
router.post('/api/consumers', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.registerConsumer(b.groupName, b.topic);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/consumers/:group/poll - 消费者拉取消息
router.post('/api/consumers/:group/poll', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.poll(ctx.params.group, Number(b.max || 10));
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/consumers/:group/commit - 提交 offset
router.post('/api/consumers/:group/commit', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.commit(ctx.params.group, b.offsets || []);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});
// GET /api/topics/:name/offsets - 各 partition 的 offset
router.get('/api/topics/:name/offsets', (ctx) => {
  try {
    ctx.body = service.offsets(ctx.params.name);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[消息队列服务] running at http://localhost:' + PORT);
});
