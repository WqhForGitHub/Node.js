import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * Kafka消费者服务
 * 消费者组 + rebalance（mock），实现 round-robin partition 分配算法
 */
// ---- 类型定义 ----
interface Topic {
  name: string;
  partitions: number;
  messages: { partition: number; offset: number; value: any }[];
}
interface ConsumerGroup {
  name: string;
  topic: string;
  members: string[];
  assignment: Map<string, number[]>; // member -> partitions
  offsets: number[]; // 各 partition 已提交 offset
  version: number; // rebalance 版本
  createdAt: number;
}
// ---- Repository 层 ----
class TopicRepository {
  private map: Map<string, Topic> = new Map();
  constructor() {
    // 默认 topic，6 个分区
    const t: Topic = { name: 'default', partitions: 6, messages: [] };
    for (let i = 0; i < 6; i++) {
      t.messages.push({ partition: i, offset: 0, value: `msg-${i}-0` });
    }
    this.map.set('default', t);
  }
  find(name: string) {
    return this.map.get(name);
  }
}
class GroupRepository {
  private map: Map<string, ConsumerGroup> = new Map();
  create(name: string, topic: string, members: string[]) {
    if (!name) throw new Error('参数缺失: name');
    if (this.map.has(name)) throw new Error('group 已存在');
    const g: ConsumerGroup = {
      name,
      topic,
      members: members || [],
      assignment: new Map(),
      offsets: [],
      version: 0,
      createdAt: Date.now(),
    };
    this.map.set(name, g);
    return g;
  }
  find(name: string) {
    return this.map.get(name);
  }
}
// ---- Service 层 ----
class KafkaService {
  constructor(
    private topics: TopicRepository,
    private groups: GroupRepository,
  ) {}
  createGroup(name: string, topic: string, members: string[]) {
    if (!topic || !members || !members.length) throw new Error('参数缺失: topic, members');
    const t = this.topics.find(topic);
    if (!t) throw new Error('topic 不存在');
    const g = this.groups.create(name, topic, members);
    g.offsets = new Array(t.partitions).fill(0);
    return g;
  }
  // rebalance：按 member 数重新分配 partition（round-robin）
  rebalance(name: string) {
    const g = this.groups.find(name);
    if (!g) throw new Error('group 不存在');
    const t = this.topics.find(g.topic);
    if (!t) throw new Error('topic 不存在');
    g.assignment = new Map();
    for (const m of g.members) g.assignment.set(m, []);
    // round-robin 分配
    const parts: number[] = [];
    for (let i = 0; i < t.partitions; i++) parts.push(i);
    for (let i = 0; i < parts.length; i++) {
      const member = g.members[i % g.members.length];
      const arr = g.assignment.get(member) || [];
      arr.push(parts[i]);
      g.assignment.set(member, arr);
    }
    g.version++;
    return {
      group: g.name,
      topic: g.topic,
      version: g.version,
      assignment: Array.from(g.assignment.entries()).map(([m, ps]) => ({
        member: m,
        partitions: ps,
      })),
    };
  }
  assignments(name: string) {
    const g = this.groups.find(name);
    if (!g) throw new Error('group 不存在');
    return {
      group: g.name,
      topic: g.topic,
      version: g.version,
      assignment: Array.from(g.assignment.entries()).map(([m, ps]) => ({
        member: m,
        partitions: ps,
      })),
    };
  }
  // 按分配方案消费，返回各 member 的消息
  consume(name: string) {
    const g = this.groups.find(name);
    if (!g) throw new Error('group 不存在');
    const t = this.topics.find(g.topic);
    if (!t) throw new Error('topic 不存在');
    if (g.assignment.size === 0) throw new Error('请先 rebalance');
    const result: { member: string; messages: any[] }[] = [];
    for (const [member, parts] of g.assignment.entries()) {
      const msgs: any[] = [];
      for (const p of parts) {
        const start = g.offsets[p] || 0;
        const partMsgs = t.messages.filter((m) => m.partition === p).slice(start);
        msgs.push(...partMsgs);
        g.offsets[p] = start + partMsgs.length;
      }
      result.push({ member, messages: msgs });
    }
    return result;
  }
  // 提交各 partition offset
  commit(name: string, offsets: Record<number, number>) {
    const g = this.groups.find(name);
    if (!g) throw new Error('group 不存在');
    for (const k of Object.keys(offsets)) {
      g.offsets[Number(k)] = offsets[Number(k)];
    }
    return g.offsets;
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new KafkaService(new TopicRepository(), new GroupRepository());

// POST /api/groups - 创建消费者组
router.post('/api/groups', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.status = 201;
    ctx.body = service.createGroup(b.name, b.topic, b.members);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/groups/:name/rebalance - rebalance
router.post('/api/groups/:name/rebalance', (ctx) => {
  try {
    ctx.body = service.rebalance(ctx.params.name);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/groups/:name/assignments - 当前分配方案
router.get('/api/groups/:name/assignments', (ctx) => {
  try {
    ctx.body = service.assignments(ctx.params.name);
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});
// POST /api/groups/:name/consume - 按分配方案消费
router.post('/api/groups/:name/consume', (ctx) => {
  try {
    ctx.body = service.consume(ctx.params.name);
  } catch (e: any) {
    ctx.status = e.message.includes('不存在') ? 404 : 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/groups/:name/commit - 提交各 partition offset
router.post('/api/groups/:name/commit', (ctx) => {
  try {
    const b: any = ctx.request.body || {};
    ctx.body = service.commit(ctx.params.name, b.offsets || {});
  } catch (e: any) {
    ctx.status = 404;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[Kafka消费者服务] running at http://localhost:' + PORT);
});
