import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 异常日志平台
 * 异常日志查询 + 告警规则，按 service+message 分组找高频异常
 */

// ---- 类型定义 ----
interface Exception {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  createdAt: number;
}

interface AlertRule {
  id: string;
  service?: string;
  threshold: number;
  windowMs: number;
  createdAt: number;
}

// ---- Repository 层 ----
class ExceptionRepository {
  private exceptions: Exception[] = [];
  private rules: AlertRule[] = [];

  insert(e: Exception): void {
    this.exceptions.push(e);
  }

  findById(id: string): Exception | undefined {
    return this.exceptions.find((e) => e.id === id);
  }

  findAll(): Exception[] {
    return this.exceptions;
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  findRules(): AlertRule[] {
    return this.rules;
  }
}

// ---- Service 层 ----
class ExceptionService {
  constructor(private repo: ExceptionRepository) {}

  ingest(data: any): Exception {
    if (!data.service) throw { status: 400, message: 'service required' };
    if (!data.message) throw { status: 400, message: 'message required' };
    const level = data.level || 'error';
    const valid = ['debug', 'info', 'warn', 'error', 'fatal'];
    if (!valid.includes(level)) throw { status: 400, message: 'invalid level' };
    const e: Exception = {
      id: crypto.randomBytes(8).toString('hex'),
      level,
      service: data.service,
      message: data.message,
      stack: data.stack,
      context: data.context,
      createdAt: Date.now(),
    };
    this.repo.insert(e);
    return e;
  }

  get(id: string): Exception {
    const e = this.repo.findById(id);
    if (!e) throw { status: 404, message: 'exception not found' };
    return e;
  }

  // 多条件 + 全文搜索
  search(filter: { level?: string; service?: string; q?: string }): Exception[] {
    let list = this.repo.findAll();
    if (filter.level) list = list.filter((e) => e.level === filter.level);
    if (filter.service) list = list.filter((e) => e.service === filter.service);
    if (filter.q) {
      const q = String(filter.q).toLowerCase();
      list = list.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          (e.stack || '').toLowerCase().includes(q) ||
          JSON.stringify(e.context || {}).toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }

  // 按 service+message 分组 count，找高频异常
  grouped(): any[] {
    const groups = new Map<string, { service: string; message: string; count: number; lastSeen: number; level: string }>();
    for (const e of this.repo.findAll()) {
      const key = e.service + '::' + e.message;
      const g = groups.get(key);
      if (g) {
        g.count++;
        if (e.createdAt > g.lastSeen) g.lastSeen = e.createdAt;
      } else {
        groups.set(key, { service: e.service, message: e.message, count: 1, lastSeen: e.createdAt, level: e.level });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }

  createRule(data: any): AlertRule {
    if (data.threshold === undefined) throw { status: 400, message: 'threshold required' };
    if (data.windowMs === undefined) throw { status: 400, message: 'windowMs required' };
    const rule: AlertRule = {
      id: crypto.randomBytes(8).toString('hex'),
      service: data.service,
      threshold: Number(data.threshold),
      windowMs: Number(data.windowMs),
      createdAt: Date.now(),
    };
    this.repo.addRule(rule);
    return rule;
  }

  // 评估告警规则（在 windowMs 内某 service 异常数 > threshold 触发）
  evaluateAlerts(): any[] {
    const now = Date.now();
    const triggered: any[] = [];
    for (const rule of this.repo.findRules()) {
      const recent = this.repo.findAll().filter((e) => {
        if (now - e.createdAt > rule.windowMs) return false;
        if (rule.service && e.service !== rule.service) return false;
        return true;
      });
      if (recent.length > rule.threshold) {
        triggered.push({ ruleId: rule.id, service: rule.service, count: recent.length, threshold: rule.threshold });
      }
    }
    return triggered;
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ExceptionService(new ExceptionRepository());

// POST /api/exceptions - 接入异常
router.post('/api/exceptions', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.ingest(ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/exceptions/grouped - 分组统计（需放在 :id 之前）
router.get('/api/exceptions/grouped', (ctx) => {
  ctx.body = service.grouped();
});

// GET /api/exceptions - 多条件 + 全文搜索
router.get('/api/exceptions', (ctx) => {
  const q = ctx.query as any;
  ctx.body = service.search({ level: q.level, service: q.service, q: q.q });
});

// GET /api/exceptions/:id - 详情
router.get('/api/exceptions/:id', (ctx) => {
  try {
    ctx.body = service.get(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/alerts/rules - 创建告警规则
router.post('/api/alerts/rules', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.createRule(ctx.request.body as any || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/alerts/triggered - 触发的告警（附加）
router.get('/api/alerts/triggered', (ctx) => {
  ctx.body = service.evaluateAlerts();
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[异常日志平台] running at http://localhost:' + PORT);
});
