// 指标采集 + 告警 服务器
const http = require('http');
const url = require('url');
const { Registry } = require('./metrics');
const AlertManager = require('./alert');

const PORT = 7400;
const registry = new Registry();
const alerter = new AlertManager();

// 历史快照（用于绘图）
const history = []; // { ts, snapshot }
const MAX_HISTORY = 300;

// 默认告警规则
alerter.addRule({
  name: '错误率过高',
  metric: 'http_errors_total',
  op: '>',
  threshold: 100,
  duration: 0,
});
alerter.addRule({
  name: '响应时间 P99 过高',
  metric: 'http_request_duration_ms',
  field: 'p99',
  op: '>',
  threshold: 1000,
  duration: 5000,
});

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  // POST /metrics/inc?name=xxx
  if (req.method === 'POST' && u.pathname === '/metrics/inc') {
    registry.counter(u.query.name).inc({}, parseFloat(u.query.value || '1'));
    res.end('{"ok":true}');
    return;
  }
  if (req.method === 'POST' && u.pathname === '/metrics/gauge') {
    registry.gauge(u.query.name).set({}, parseFloat(u.query.value));
    res.end('{"ok":true}');
    return;
  }
  if (req.method === 'POST' && u.pathname === '/metrics/observe') {
    registry.histogram(u.query.name).observe(parseFloat(u.query.value));
    res.end('{"ok":true}');
    return;
  }

  if (req.method === 'GET' && u.pathname === '/metrics') {
    res.setHeader('Content-Type', 'text/plain');
    res.end(registry.prometheus());
    return;
  }
  if (req.method === 'GET' && u.pathname === '/snapshot') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(registry.snapshot()));
    return;
  }
  if (req.method === 'GET' && u.pathname === '/history') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(history));
    return;
  }
  if (req.method === 'GET' && u.pathname === '/alerts') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({ firing: [...alerter.firing.keys()], history: alerter.history.slice(-50) })
    );
    return;
  }

  if (req.method === 'POST' && u.pathname === '/rules') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        const id = alerter.addRule(JSON.parse(body));
        res.end(JSON.stringify({ ok: true, id }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>指标监控</title>
<style>body{font-family:monospace;padding:20px}pre{background:#f0f0f0;padding:10px}</style></head>
<body><h2>指标监控系统</h2>
<h3>当前快照</h3><pre id="s"></pre>
<h3>告警</h3><pre id="a"></pre>
<script>
async function refresh(){
  document.getElementById('s').textContent=JSON.stringify(await(await fetch('/snapshot')).json(),null,2);
  document.getElementById('a').textContent=JSON.stringify(await(await fetch('/alerts')).json(),null,2);
}
refresh();setInterval(refresh,2000);
</script></body></html>`);
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

// 周期评估告警 + 保存历史
setInterval(() => {
  const snap = registry.snapshot();
  history.push({ ts: Date.now(), snapshot: snap });
  if (history.length > MAX_HISTORY) history.shift();
  alerter.evaluate(snap);
}, 2000);

server.listen(PORT, () => console.log(`指标监控: http://127.0.0.1:${PORT}`));
process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
