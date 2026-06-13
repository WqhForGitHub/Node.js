// 演示应用：模拟带追踪的业务调用
const http = require('http');
const { Tracer } = require('./tracer');

Tracer.serviceName = 'demo-app';
const SPAN_API = 'http://127.0.0.1:7500/spans';

// 报告 span：批量发送
let buffer = [];
Tracer.reporter = (span) => {
  buffer.push({
    traceId: span.traceId, spanId: span.spanId, parentId: span.parentId,
    name: span.name, service: span.service,
    startTime: span.startTime, duration: span.duration,
    tags: span.tags, status: span.status, logs: span.logs
  });
  if (buffer.length >= 10) flush();
};

function flush() {
  if (buffer.length === 0) return;
  const data = JSON.stringify(buffer);
  buffer = [];
  const req = http.request(SPAN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => res.on('data', () => {}));
  req.on('error', e => console.error('上报失败:', e.message));
  req.end(data);
}
setInterval(flush, 1000);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 模拟业务请求
async function handleRequest() {
  const root = Tracer.startTrace('GET /api/order');
  root.setTag('http.method', 'GET').setTag('http.path', '/api/order');

  await Tracer.trace('auth.verify', root, async (s) => {
    await sleep(5 + Math.random() * 10);
  });

  await Tracer.trace('db.query.user', root, async (s) => {
    s.setTag('db.statement', 'SELECT * FROM users WHERE id=?');
    await sleep(20 + Math.random() * 30);
  });

  await Tracer.trace('db.query.orders', root, async (s) => {
    s.setTag('db.statement', 'SELECT * FROM orders');
    await sleep(50 + Math.random() * 100);
    if (Math.random() < 0.05) throw new Error('DB timeout');
  }).catch(() => {});

  await Tracer.trace('cache.get', root, async (s) => {
    await sleep(1 + Math.random() * 3);
  });

  if (Math.random() < 0.1) root.setError(new Error('请求失败'));
  root.setTag('http.status', root.status === 'error' ? 500 : 200).finish();
}

console.log('开始模拟带追踪的请求...');
setInterval(() => handleRequest().catch(() => {}), 500);

process.on('SIGINT', () => { flush(); setTimeout(() => process.exit(0), 500); });
