// APM 收集服务器：接收 span，组装调用链
const http = require('http');
const url = require('url');

const PORT = 7500;

// traceId => [span]
const traces = new Map();
// service => stats
const serviceStats = new Map();
const MAX_TRACES = 500;
const traceOrder = [];

function addSpan(span) {
  const tid = span.traceId;
  if (!traces.has(tid)) {
    traces.set(tid, []);
    traceOrder.push(tid);
    // LRU 淘汰
    while (traceOrder.length > MAX_TRACES) {
      const old = traceOrder.shift();
      traces.delete(old);
    }
  }
  traces.get(tid).push(span);

  // 服务级聚合
  const svc = span.service || 'unknown';
  if (!serviceStats.has(svc)) {
    serviceStats.set(svc, { count: 0, errors: 0, totalDuration: 0, durations: [] });
  }
  const s = serviceStats.get(svc);
  s.count++;
  if (span.status === 'error') s.errors++;
  s.totalDuration += span.duration || 0;
  s.durations.push(span.duration || 0);
  if (s.durations.length > 1000) s.durations.shift();
}

function buildTree(traceId) {
  const spans = traces.get(traceId) || [];
  const map = new Map(spans.map((s) => [s.spanId, { ...s, children: [] }]));
  let root = null;
  for (const s of map.values()) {
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId).children.push(s);
    } else {
      root = s;
    }
  }
  return root;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor((p / 100) * (sorted.length - 1))];
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && u.pathname === '/spans') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const arr = Array.isArray(data) ? data : [data];
        for (const s of arr) addSpan(s);
        res.end(JSON.stringify({ ok: true, count: arr.length }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/traces') {
    const list = traceOrder
      .slice(-50)
      .reverse()
      .map((tid) => {
        const spans = traces.get(tid) || [];
        const root = spans.find((s) => !s.parentId) || spans[0];
        const hasError = spans.some((s) => s.status === 'error');
        return {
          traceId: tid,
          service: root && root.service,
          operation: root && root.name,
          duration: root && root.duration,
          spans: spans.length,
          error: hasError,
          startTime: root && root.startTime,
        };
      });
    res.end(JSON.stringify(list));
    return;
  }

  const m = u.pathname.match(/^\/traces\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const tree = buildTree(m[1]);
    if (!tree) {
      res.statusCode = 404;
      res.end('{"error":"not found"}');
      return;
    }
    res.end(JSON.stringify(tree));
    return;
  }

  if (req.method === 'GET' && u.pathname === '/services') {
    const out = [];
    for (const [name, s] of serviceStats) {
      out.push({
        name,
        requests: s.count,
        errors: s.errors,
        errorRate: s.count ? s.errors / s.count : 0,
        avgDuration: s.count ? s.totalDuration / s.count : 0,
        p95: percentile(s.durations, 95),
        p99: percentile(s.durations, 99),
      });
    }
    res.end(JSON.stringify(out));
    return;
  }

  if (req.method === 'GET' && u.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>APM</title>
<style>body{font-family:monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}.error{color:red}pre{background:#f0f0f0;padding:10px;overflow:auto}</style></head>
<body><h2>性能监控平台 (APM)</h2>
<h3>服务概览</h3><div id="svc"></div>
<h3>最近调用链</h3><div id="traces"></div>
<h3>调用链详情</h3><pre id="detail">点击 traceId 查看</pre>
<script>
async function refresh(){
  const svc=await(await fetch('/services')).json();
  document.getElementById('svc').innerHTML='<table><tr><th>服务</th><th>请求</th><th>错误</th><th>错误率</th><th>平均耗时</th><th>P95</th><th>P99</th></tr>'+svc.map(s=>'<tr><td>'+s.name+'</td><td>'+s.requests+'</td><td>'+s.errors+'</td><td>'+(s.errorRate*100).toFixed(2)+'%</td><td>'+s.avgDuration.toFixed(2)+'ms</td><td>'+s.p95.toFixed(2)+'</td><td>'+s.p99.toFixed(2)+'</td></tr>').join('')+'</table>';
  const t=await(await fetch('/traces')).json();
  document.getElementById('traces').innerHTML='<table><tr><th>TraceId</th><th>服务</th><th>操作</th><th>耗时</th><th>Spans</th></tr>'+t.map(x=>'<tr class="'+(x.error?'error':'')+'"><td><a href="#" onclick="show(\\''+x.traceId+'\\')">'+x.traceId.slice(0,8)+'</a></td><td>'+(x.service||'')+'</td><td>'+(x.operation||'')+'</td><td>'+(x.duration?x.duration.toFixed(2):'')+'ms</td><td>'+x.spans+'</td></tr>').join('')+'</table>';
}
async function show(tid){const r=await(await fetch('/traces/'+tid)).json();document.getElementById('detail').textContent=JSON.stringify(r,null,2);}
refresh();setInterval(refresh,3000);
</script></body></html>`);
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
});

server.listen(PORT, () => console.log(`APM 平台: http://127.0.0.1:${PORT}`));
process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
