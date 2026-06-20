import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 链路追踪服务
 * trace/span 管理，构建 span 树结构
 */

// ---- 类型定义 ----
interface Span {
  spanId: string;
  traceId: string;
  name: string;
  parentId?: string;
  startTime: number;
  durationMs?: number;
  tags?: Record<string, any>;
}

interface Trace {
  traceId: string;
  service: string;
  spans: Span[];
  createdAt: number;
}

// ---- Repository 层 ----
class TraceRepository {
  private traces: Map<string, Trace> = new Map();

  create(traceId: string, service: string): Trace {
    const trace: Trace = { traceId, service, spans: [], createdAt: Date.now() };
    this.traces.set(traceId, trace);
    return trace;
  }

  findById(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  addSpan(traceId: string, span: Span): Trace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;
    trace.spans.push(span);
    return trace;
  }

  findAll(): Trace[] {
    return Array.from(this.traces.values());
  }
}

// ---- Service 层 ----
class TraceService {
  constructor(private repo: TraceRepository) {}

  createTrace(service: string): Trace {
    const traceId = crypto.randomBytes(8).toString('hex');
    return this.repo.create(traceId, service);
  }

  addSpan(traceId: string, data: any): Span {
    const trace = this.repo.findById(traceId);
    if (!trace) throw { status: 404, message: 'trace not found' };
    if (!data.name) throw { status: 400, message: 'span name required' };
    const span: Span = {
      spanId: crypto.randomBytes(8).toString('hex'),
      traceId,
      name: data.name,
      parentId: data.parentId,
      startTime: Date.now(),
      durationMs: data.durationMs,
      tags: data.tags,
    };
    this.repo.addSpan(traceId, span);
    return span;
  }

  getTrace(traceId: string): Trace {
    const trace = this.repo.findById(traceId);
    if (!trace) throw { status: 404, message: 'trace not found' };
    return trace;
  }

  // 构建 span 树结构
  buildTree(traceId: string): any {
    const trace = this.getTrace(traceId);
    const byParent = new Map<string, Span[]>();
    for (const s of trace.spans) {
      const key = s.parentId || 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(s);
    }
    const build = (parentId: string): any[] => {
      const children = byParent.get(parentId) || [];
      return children.map((s) => ({
        ...s,
        children: build(s.spanId),
      }));
    };
    return { traceId: trace.traceId, service: trace.service, tree: build('root') };
  }

  // span 时间线，按 startTime 排序
  getTimeline(traceId: string): any {
    const trace = this.getTrace(traceId);
    const sorted = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
    const base = sorted.length ? sorted[0].startTime : Date.now();
    return {
      traceId,
      baseTime: base,
      spans: sorted.map((s) => ({
        spanId: s.spanId,
        name: s.name,
        parentId: s.parentId,
        startTime: s.startTime,
        offsetMs: s.startTime - base,
        durationMs: s.durationMs,
        tags: s.tags,
      })),
    };
  }

  list(filter: { service?: string; from?: number; to?: number }): Trace[] {
    let list = this.repo.findAll();
    if (filter.service) list = list.filter((t) => t.service === filter.service);
    if (filter.from) list = list.filter((t) => t.createdAt >= filter.from!);
    if (filter.to) list = list.filter((t) => t.createdAt <= filter.to!);
    return list;
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new TraceService(new TraceRepository());

// POST /api/traces - 创建 trace
router.post('/api/traces', (ctx) => {
  const body = ctx.request.body as any || {};
  if (!body.service) { ctx.status = 400; ctx.body = { message: 'service required' }; return; }
  ctx.status = 201;
  ctx.body = service.createTrace(body.service);
});

// POST /api/traces/:traceId/spans - 添加 span
router.post('/api/traces/:traceId/spans', (ctx) => {
  try {
    const span = service.addSpan(ctx.params.traceId, ctx.request.body as any || {});
    ctx.status = 201;
    ctx.body = span;
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/traces/:traceId - trace 详情含 span 树
router.get('/api/traces/:traceId', (ctx) => {
  try {
    ctx.body = service.buildTree(ctx.params.traceId);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/traces - trace 列表（带过滤）
router.get('/api/traces', (ctx) => {
  const q = ctx.query as any;
  ctx.body = service.list({
    service: q.service,
    from: q.from ? Number(q.from) : undefined,
    to: q.to ? Number(q.to) : undefined,
  });
});

// GET /api/traces/:traceId/timeline - span 时间线
router.get('/api/traces/:traceId/timeline', (ctx) => {
  try {
    ctx.body = service.getTimeline(ctx.params.traceId);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[链路追踪服务] running at http://localhost:' + PORT);
});
