import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 错误监控系统
 * 错误事件接入 + 聚合（类似 Sentry），指纹去重
 */

// ---- 类型定义 ----
interface ErrorEvent {
  id: string;
  message: string;
  stack?: string;
  type: string;
  release?: string;
  userAgent?: string;
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
}

// ---- Repository 层 ----
class ErrorRepository {
  private errors: Map<string, ErrorEvent> = new Map();

  findById(id: string): ErrorEvent | undefined {
    return this.errors.get(id);
  }

  findByFingerprint(fp: string): ErrorEvent | undefined {
    return this.errors.get(fp);
  }

  upsert(event: ErrorEvent): void {
    this.errors.set(event.id, event);
    this.errors.set(event.fingerprint, event); // 指纹索引（同 id 引用）
  }

  findAll(): ErrorEvent[] {
    const seen = new Set<string>();
    const list: ErrorEvent[] = [];
    for (const e of this.errors.values()) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      list.push(e);
    }
    return list;
  }
}

// ---- Service 层 ----
class ErrorService {
  constructor(private repo: ErrorRepository) {}

  // 指纹：同 message + type 合并
  private fingerprint(message: string, type: string): string {
    return crypto
      .createHash('md5')
      .update(type + '::' + message)
      .digest('hex');
  }

  report(data: any): ErrorEvent {
    if (!data.message) throw { status: 400, message: 'message required' };
    if (!data.type) throw { status: 400, message: 'type required' };
    const fp = this.fingerprint(data.message, data.type);
    const existing = this.repo.findByFingerprint(fp);
    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
      if (data.stack) existing.stack = data.stack;
      return existing;
    }
    const id = crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const event: ErrorEvent = {
      id,
      message: data.message,
      stack: data.stack,
      type: data.type,
      release: data.release,
      userAgent: data.userAgent,
      fingerprint: fp,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      resolved: false,
    };
    this.repo.upsert(event);
    return event;
  }

  get(id: string): ErrorEvent {
    const e = this.repo.findById(id);
    if (!e) throw { status: 404, message: 'error not found' };
    return e;
  }

  list(filter: { release?: string; type?: string; page?: number; pageSize?: number }): {
    items: ErrorEvent[];
    total: number;
    page: number;
    pageSize: number;
  } {
    let list = this.repo.findAll();
    if (filter.release) list = list.filter((e) => e.release === filter.release);
    if (filter.type) list = list.filter((e) => e.type === filter.type);
    list.sort((a, b) => b.lastSeen - a.lastSeen);
    const total = list.length;
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;
    const items = list.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // 按 type 聚合，按 release 分组 count
  stats(): any {
    const list = this.repo.findAll();
    const byType: Record<string, number> = {};
    const byRelease: Record<string, number> = {};
    for (const e of list) {
      byType[e.type] = (byType[e.type] || 0) + e.count;
      const rel = e.release || 'unknown';
      byRelease[rel] = (byRelease[rel] || 0) + e.count;
    }
    return {
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byRelease: Object.entries(byRelease).map(([release, count]) => ({ release, count })),
      totalErrors: list.length,
      totalOccurrences: list.reduce((s, e) => s + e.count, 0),
    };
  }

  resolve(id: string): ErrorEvent {
    const e = this.get(id);
    e.resolved = true;
    return e;
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ErrorService(new ErrorRepository());

// GET /api/errors/stats - 聚合统计（需放在 :id 路由之前）
router.get('/api/errors/stats', (ctx) => {
  ctx.body = service.stats();
});

// POST /api/errors - 上报错误
router.post('/api/errors', (ctx) => {
  try {
    const e = service.report((ctx.request.body as any) || {});
    ctx.status = 201;
    ctx.body = e;
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/errors - 列表（过滤 + 分页）
router.get('/api/errors', (ctx) => {
  const q = ctx.query as any;
  ctx.body = service.list({
    release: q.release,
    type: q.type,
    page: q.page ? Number(q.page) : 1,
    pageSize: q.pageSize ? Number(q.pageSize) : 20,
  });
});

// GET /api/errors/:id - 详情
router.get('/api/errors/:id', (ctx) => {
  try {
    ctx.body = service.get(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/errors/:id/resolve - 标记已解决
router.post('/api/errors/:id/resolve', (ctx) => {
  try {
    ctx.body = service.resolve(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[错误监控系统] running at http://localhost:' + PORT);
});
