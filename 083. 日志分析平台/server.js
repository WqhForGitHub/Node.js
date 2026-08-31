// 日志接收 + 查询服务
const http = require('http');
const net = require('net');
const url = require('url');
const LogParser = require('./parser');
const LogStore = require('./store');

const HTTP_PORT = 7300;
const TCP_PORT = 7301;
const store = new LogStore();

// ========== HTTP API ==========
const httpServer = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && u.pathname === '/ingest') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const lines = body.split('\n');
      let n = 0;
      for (const line of lines) {
        const e = LogParser.parse(line);
        if (e) {
          if (u.query.source) e.source = u.query.source;
          store.add(e);
          n++;
        }
      }
      res.end(JSON.stringify({ ok: true, ingested: n }));
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/search') {
    const results = store.search({
      q: u.query.q,
      level: u.query.level,
      source: u.query.source,
      limit: parseInt(u.query.limit || '100'),
    });
    res.end(JSON.stringify(results));
    return;
  }

  if (req.method === 'GET' && u.pathname === '/stats') {
    res.end(JSON.stringify(store.stats()));
    return;
  }

  // 简单的 web UI
  if (req.method === 'GET' && u.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>日志分析</title>
<style>body{font-family:monospace;padding:20px}input{width:300px}.log{padding:4px;border-bottom:1px solid #eee}.error{color:red}.warn{color:orange}.info{color:#333}</style>
</head><body>
<h2>日志分析平台</h2>
<input id="q" placeholder="搜索关键字"/>
<select id="level"><option value="">全部</option><option>info</option><option>warn</option><option>error</option></select>
<button onclick="search()">搜索</button>
<div id="stats"></div>
<div id="results"></div>
<script>
async function loadStats(){const s=await(await fetch('/stats')).json();document.getElementById('stats').innerHTML='<b>统计</b>: info='+s.byLevel.info+' warn='+s.byLevel.warn+' error='+s.byLevel.error}
async function search(){const q=document.getElementById('q').value;const l=document.getElementById('level').value;const r=await(await fetch('/search?q='+encodeURIComponent(q)+'&level='+l)).json();document.getElementById('results').innerHTML=r.map(e=>'<div class="log '+e.level+'">['+e.level+'] '+new Date(e.ts).toISOString()+' '+(e.message||JSON.stringify(e))+'</div>').join('')}
loadStats();setInterval(loadStats,5000);
</script></body></html>`);
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
});

// ========== TCP 流式接收（syslog 风格）==========
const tcpServer = net.createServer((socket) => {
  let buffer = '';
  const source = `tcp-${socket.remoteAddress}:${socket.remotePort}`;
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const e = LogParser.parse(line);
      if (e) {
        e.source = e.source || source;
        store.add(e);
      }
    }
  });
  socket.on('error', () => {});
});

httpServer.listen(HTTP_PORT, () => console.log(`HTTP API + UI: http://127.0.0.1:${HTTP_PORT}`));
tcpServer.listen(TCP_PORT, () => console.log(`TCP 日志接入: tcp://127.0.0.1:${TCP_PORT}`));

process.on('SIGINT', () => {
  httpServer.close();
  tcpServer.close();
  process.exit(0);
});
