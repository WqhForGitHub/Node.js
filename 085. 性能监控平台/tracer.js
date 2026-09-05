// APM Tracer：调用链追踪
const { randomBytes } = require('crypto');

function genId(n = 8) {
  return randomBytes(n).toString('hex');
}

class Span {
  constructor(name, traceId, parentId) {
    this.traceId = traceId;
    this.spanId = genId(8);
    this.parentId = parentId || null;
    this.name = name;
    this.startTime = Date.now();
    this.startHr = process.hrtime.bigint();
    this.endTime = null;
    this.duration = null;
    this.tags = {};
    this.logs = [];
    this.status = 'ok';
  }
  setTag(k, v) {
    this.tags[k] = v;
    return this;
  }
  log(event, data) {
    this.logs.push({ ts: Date.now(), event, data });
    return this;
  }
  setError(err) {
    this.status = 'error';
    this.tags.error = true;
    this.tags['error.message'] = err.message;
    return this;
  }
  finish() {
    this.endTime = Date.now();
    this.duration = Number(process.hrtime.bigint() - this.startHr) / 1e6; // ms
    Tracer.report(this);
    return this;
  }
}

class Tracer {
  static reporter = null;
  static serviceName = 'unknown';
  static report(span) {
    span.service = this.serviceName;
    if (this.reporter) this.reporter(span);
  }
  static startTrace(name) {
    return new Span(name, genId(16), null);
  }
  static startSpan(name, parent) {
    if (!parent) return this.startTrace(name);
    return new Span(name, parent.traceId, parent.spanId);
  }
  // 包装异步函数自动追踪
  static async trace(name, parent, fn) {
    const span = this.startSpan(name, parent);
    try {
      const result = await fn(span);
      span.finish();
      return result;
    } catch (e) {
      span.setError(e).finish();
      throw e;
    }
  }
}

module.exports = { Tracer, Span };
