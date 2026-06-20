import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 日志收集系统
 * agent 心跳、批量日志接入、多条件过滤分页、日志源与统计
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
interface LogEntry {
  id: number;
  source: string;
  level: Level;
  message: string;
  timestamp: number;
}
interface Agent {
  id: string;
  source: string;
  lastHeartbeat: number;
}
// ---- Repository 层 ----
class LogRepository {
  private logs: LogEntry[] = [];
  private agents: Agent[] = [];
  private seq = 1;
  heartbeat(agentId: string, source: string) {
    let a = this.agents.find((x) => x.id === agentId);
    if (!a) {
      a = { id: agentId, source, lastHeartbeat: Date.now() };
      this.agents.push(a);
    } else {
      a.lastHeartbeat = Date.now();
      a.source = source;
    }
    return a;
  }
  ingest(source: string, logs: any[]) {
    const out: LogEntry[] = [];
    for (const l of logs) {
      out.push({
        id: this.seq++,
        source,
        level: (l.level || 'info') as Level,
        message: l.message || '',
        timestamp: l.timestamp || Date.now(),
      });
    }
    this.logs.push(...out);
    return { ingested: out.length };
  }
  query(filter: {
    source?: string;
    level?: Level;
    from?: number;
    to?: number;
    page: number;
    size: number;
  }) {
    let list = this.logs.slice();
    if (filter.source) list = list.filter((l) => l.source === filter.source);
    if (filter.level) list = list.filter((l) => l.level === filter.level);
    if (filter.from) list = list.filter((l) => l.timestamp >= filter.from!);
    if (filter.to) list = list.filter((l) => l.timestamp <= filter.to!);
    list.sort((a, b) => b.timestamp - a.timestamp);
    const total = list.length;
    const start = (filter.page - 1) * filter.size;
    return {
      total,
      page: filter.page,
      size: filter.size,
      data: list.slice(start, start + filter.size),
    };
  }
  sources() {
    const set = new Set<string>();
    this.logs.forEach((l) => set.add(l.source));
    this.agents.forEach((a) => set.add(a.source));
    return Array.from(set);
  }
  stats() {
    const map: Record<string, number> = {};
    this.logs.forEach((l) => {
      map[l.source] = (map[l.source] || 0) + 1;
    });
    return Object.entries(map).map(([source, count]) => ({ source, count }));
  }
}
// ---- Service 层 ----
class LogService {
  constructor(private repo: LogRepository) {}
  heartbeat(body: any) {
    if (!body || !body.agentId || !body.source) throw new Error('参数缺失: agentId/source');
    return this.repo.heartbeat(body.agentId, body.source);
  }
  ingest(body: any) {
    if (!body || !body.source || !Array.isArray(body.logs))
      throw new Error('参数缺失: source/logs');
    return this.repo.ingest(body.source, body.logs);
  }
  query(query: any) {
    const page = Number(query.page) || 1;
    const size = Number(query.size) || 20;
    return this.repo.query({
      source: query.source,
      level: query.level as Level | undefined,
      from: query.from ? Number(query.from) : undefined,
      to: query.to ? Number(query.to) : undefined,
      page,
      size,
    });
  }
  sources() {
    return this.repo.sources();
  }
  stats() {
    return this.repo.stats();
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new LogService(new LogRepository());

// agent 心跳上报
router.post('/api/agents/heartbeat', (ctx) => {
  try {
    ctx.body = service.heartbeat(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 批量日志接入
router.post('/api/logs/ingest', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.ingest(ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 多条件过滤 + 分页
router.get('/api/logs', (ctx) => {
  ctx.body = service.query(ctx.query);
});
// 日志源列表
router.get('/api/logs/sources', (ctx) => {
  ctx.body = service.sources();
});
// 按 source 统计
router.get('/api/logs/stats', (ctx) => {
  ctx.body = service.stats();
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[日志收集系统] running at http://localhost:' + PORT));
