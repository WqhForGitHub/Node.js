import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 数据分析系统
 * 事件埋点、指标聚合（按事件名 count）、漏斗分析（步骤数组转化）
 */

interface Event {
  id: number;
  name: string;
  userId: number;
  properties: Record<string, any>;
  timestamp: string;
}

// ---- Repository 层 ----
class AnalyticsRepository {
  private events: Event[] = [];
  add(e: Event) {
    this.events.push(e);
    return e;
  }
  findByName(name: string) {
    return this.events.filter((e) => e.name === name);
  }
  findAll() {
    return this.events;
  }
}

// ---- Service 层 ----
class AnalyticsService {
  constructor(private repo: AnalyticsRepository) {}
  // 上报事件
  track(name: string, userId: number, properties: Record<string, any>) {
    if (!name) throw new Error('缺少 name');
    if (!userId) throw new Error('缺少 userId');
    return this.repo.add({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      userId,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    });
  }
  // 指标聚合：按事件名统计 count
  metric(name: string) {
    const list = this.repo.findByName(name);
    // 按 properties 维度简单分组
    const byDimension: Record<string, number> = {};
    for (const e of list) {
      const key = JSON.stringify(e.properties) || '{}';
      byDimension[key] = (byDimension[key] || 0) + 1;
    }
    return { name, count: list.length, dimensions: byDimension };
  }
  // 漏斗分析：传入步骤数组返回每步转化
  funnel(steps: string[]) {
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('steps 不能为空');
    const all = this.repo.findAll();
    // 找出每个步骤发生的用户集合（按用户首次发生该步骤）
    const stepUsers: Set<number>[] = steps.map((step) => {
      const users = new Set<number>();
      for (const e of all) {
        if (e.name === step) users.add(e.userId);
      }
      return users;
    });
    // 漏斗：用户必须在前面步骤出现过才计入后续
    const result = steps.map((name, idx) => {
      const prevUsers = idx === 0 ? stepUsers[0] : intersection(stepUsers[idx], stepUsers[idx - 1]);
      stepUsers[idx] = prevUsers; // 链式收缩
      return { step: idx + 1, name, count: prevUsers.size };
    });
    return result;
  }
}

// 集合求交集
function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const r = new Set<T>();
  for (const v of a) if (b.has(v)) r.add(v);
  return r;
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new AnalyticsService(new AnalyticsRepository());

// 上报事件
router.post('/api/events', (ctx) => {
  const { name, userId, properties } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.track(name, Number(userId), properties);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 指标聚合
router.get('/api/metrics/:name', (ctx) => {
  ctx.body = service.metric(ctx.params.name);
});
// 漏斗分析
router.get('/api/funnel', (ctx) => {
  let steps: string[] = [];
  const q = ctx.query.steps;
  if (Array.isArray(q)) steps = q as string[];
  else if (typeof q === 'string') steps = q.split(',');
  try {
    ctx.body = service.funnel(steps);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[数据分析系统] running at http://localhost:' + PORT);
});
