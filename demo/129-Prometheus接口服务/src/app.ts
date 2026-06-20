import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * Prometheus接口服务
 * 实现 Counter/Gauge/Histogram 指标类，并暴露 Prometheus 文本格式
 */
// 标签序列化：{key="value",key2="value2"}
function serializeLabels(labels: Record<string, string> = {}) {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return '{' + keys.map((k) => `${k}="${labels[k]}"`).join(',') + '}';
}
// ---- 指标类 ----
class Counter {
  private values: Record<string, number> = {};
  constructor(
    public name: string,
    public help: string,
  ) {}
  private key(labels: Record<string, string>) {
    return JSON.stringify(labels);
  }
  incr(labels: Record<string, string> = {}, by = 1) {
    const k = this.key(labels);
    this.values[k] = (this.values[k] || 0) + by;
  }
  serialize() {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const k of Object.keys(this.values)) {
      const labels = JSON.parse(k);
      lines.push(`${this.name}${serializeLabels(labels)} ${this.values[k]}`);
    }
    return lines.join('\n');
  }
}
class Gauge {
  private values: Record<string, number> = {};
  constructor(
    public name: string,
    public help: string,
  ) {}
  private key(labels: Record<string, string>) {
    return JSON.stringify(labels);
  }
  set(labels: Record<string, string> = {}, value: number) {
    this.values[this.key(labels)] = value;
  }
  serialize() {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const k of Object.keys(this.values)) {
      const labels = JSON.parse(k);
      lines.push(`${this.name}${serializeLabels(labels)} ${this.values[k]}`);
    }
    return lines.join('\n');
  }
}
class Histogram {
  private buckets = [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10];
  private observations: { labels: Record<string, string>; value: number }[] = [];
  constructor(
    public name: string,
    public help: string,
  ) {}
  observe(labels: Record<string, string> = {}, value: number) {
    this.observations.push({ labels, value });
  }
  serialize() {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    // 按 label 分组
    const groups: Record<string, { labels: Record<string, string>; values: number[] }> = {};
    for (const o of this.observations) {
      const k = JSON.stringify(o.labels);
      if (!groups[k]) groups[k] = { labels: o.labels, values: [] };
      groups[k].values.push(o.value);
    }
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      const sorted = g.values.slice().sort((a, b) => a - b);
      for (const bound of this.buckets) {
        const count = sorted.filter((v) => v <= bound).length;
        lines.push(
          `${this.name}_bucket${serializeLabels({ ...g.labels, le: String(bound) })} ${count}`,
        );
      }
      lines.push(
        `${this.name}_bucket${serializeLabels({ ...g.labels, le: '+Inf' })} ${sorted.length}`,
      );
      lines.push(
        `${this.name}_sum${serializeLabels(g.labels)} ${sorted.reduce((a, b) => a + b, 0)}`,
      );
      lines.push(`${this.name}_count${serializeLabels(g.labels)} ${sorted.length}`);
    }
    return lines.join('\n');
  }
}
// ---- 指标仓库 ----
class MetricRegistry {
  counters: Record<string, Counter> = {};
  gauges: Record<string, Gauge> = {};
  histograms: Record<string, Histogram> = {};
  incr(name: string, body: any) {
    if (!name) throw new Error('参数缺失: name');
    if (!this.counters[name]) this.counters[name] = new Counter(name, body?.help || name);
    this.counters[name].incr(body?.labels || {}, Number(body?.by) || 1);
    return this.counters[name];
  }
  gauge(name: string, body: any) {
    if (!name || !body || typeof body.value !== 'number') throw new Error('参数缺失: name/value');
    if (!this.gauges[name]) this.gauges[name] = new Gauge(name, body.help || name);
    this.gauges[name].set(body.labels || {}, body.value);
    return this.gauges[name];
  }
  observe(name: string, body: any) {
    if (!name || !body || typeof body.value !== 'number') throw new Error('参数缺失: name/value');
    if (!this.histograms[name]) this.histograms[name] = new Histogram(name, body.help || name);
    this.histograms[name].observe(body.labels || {}, body.value);
    return this.histograms[name];
  }
  serialize() {
    const parts: string[] = [];
    for (const k of Object.keys(this.counters)) parts.push(this.counters[k].serialize());
    for (const k of Object.keys(this.gauges)) parts.push(this.gauges[k].serialize());
    for (const k of Object.keys(this.histograms)) parts.push(this.histograms[k].serialize());
    return parts.join('\n') + (parts.length ? '\n' : '');
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const registry = new MetricRegistry();
// 初始化示例指标
registry.incr('app_requests_total', { labels: { method: 'GET' }, help: '应用请求总数' });

// Prometheus 拉取入口
router.get('/metrics', (ctx) => {
  ctx.type = 'text/plain; version=0.0.4; charset=utf-8';
  ctx.body = registry.serialize();
});
// 计数器递增
router.post('/api/metrics/incr', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = registry.incr((ctx.request.body as any)?.name, ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// 设置 gauge
router.post('/api/metrics/gauge', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = registry.gauge((ctx.request.body as any)?.name, ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// histogram 观测
router.post('/api/metrics/observe', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = registry.observe((ctx.request.body as any)?.name, ctx.request.body);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[Prometheus接口服务] running at http://localhost:' + PORT));
