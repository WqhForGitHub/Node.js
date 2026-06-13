// 多协议采集服务：HTTP + UDP + TCP
const http = require('http');
const dgram = require('dgram');
const net = require('net');
const url = require('url');
const Collector = require('./collector');

const HTTP_PORT = 7200;
const UDP_PORT = 7201;
const TCP_PORT = 7202;

const collector = new Collector();

// ========== HTTP 接收 + 查询 ==========
const httpServer = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && u.pathname === '/ingest') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const points = Array.isArray(data) ? data : [data];
        let ok = 0;
        for (const p of points) if (collector.ingest(p)) ok++;
        res.end(JSON.stringify({ ok: true, accepted: ok, total: points.length }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/query') {
    const results = collector.query({
      device: u.query.device,
      metric: u.query.metric,
      from: u.query.from,
      to: u.query.to,
      limit: parseInt(u.query.limit || '100')
    });
    res.end(JSON.stringify(results));
    return;
  }

  if (req.method === 'GET' && u.pathname === '/stats') {
    res.end(JSON.stringify({ ...collector.stats, buffered: collector.buffer.length }));
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
});

// ========== UDP 接收（高吞吐场景）==========
const udpServer = dgram.createSocket('udp4');
udpServer.on('message', (buf, rinfo) => {
  try {
    const lines = buf.toString().trim().split('\n');
    for (const line of lines) {
      if (line) collector.ingest(JSON.parse(line));
    }
  } catch (e) {
    console.error('UDP 解析失败:', e.message);
  }
});

// ========== TCP 流式接收 ==========
const tcpServer = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        collector.ingest(JSON.parse(line));
      } catch {}
    }
  });
  socket.on('error', () => {});
});

httpServer.listen(HTTP_PORT, () => console.log(`HTTP API: http://127.0.0.1:${HTTP_PORT}`));
udpServer.bind(UDP_PORT, () => console.log(`UDP 采集: udp://127.0.0.1:${UDP_PORT}`));
tcpServer.listen(TCP_PORT, () => console.log(`TCP 采集: tcp://127.0.0.1:${TCP_PORT}`));

setInterval(() => {
  console.log(`[stats] received=${collector.stats.received} flushed=${collector.stats.flushed} buffered=${collector.buffer.length}`);
}, 10000);

process.on('SIGINT', () => {
  console.log('\n关闭...');
  collector.shutdown();
  process.exit(0);
});
