// 数据接收服务器 - 接收 HTTP/UDP 数据并送入处理管道
const http = require('http');
const dgram = require('dgram');
const { createSource, aggregators, Sink } = require('./stream');

// 创建数据源
const source = createSource('events');

// === 处理管道 ===
// 1) 解析并丰富数据
const enriched = source.map(event => ({
  ...event,
  receivedAt: Date.now()
}));

// 2) 过滤掉无效事件
const valid = enriched.filter(e => e.type && e.userId);

// 3) 实时计数（每 5 秒一个窗口）
valid.window(5000, aggregators.count).forEach(stat => {
  console.log(`[5s 窗口] 收到 ${stat.count} 条事件`);
});

// 4) 滑动窗口热点 TopK（10 秒窗口，2 秒滑动）
valid.slidingWindow(10000, 2000, aggregators.topK('type', 3)).forEach(top => {
  console.log('[滑动 TopK] 最热事件类型:', top.top.map(t => `${t[0]}=${t[1]}`).join(', '));
});

// 5) 按事件类型分组聚合
const groupCounts = new Map();
valid.forEach(e => {
  groupCounts.set(e.type, (groupCounts.get(e.type) || 0) + 1);
});
setInterval(() => {
  if (groupCounts.size > 0) {
    console.log('  [按类型累计]', Object.fromEntries(groupCounts));
  }
}, 10000);

// 6) Sink: 异常报警
const alertSink = new Sink('alert', (data) => {
  console.log('[报警] 错误事件:', data);
});
valid.filter(e => e.type === 'error').to(alertSink);

// === HTTP 接收 ===
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        source.emit('data', event);
        res.writeHead(202).end('OK');
      } catch (e) {
        res.writeHead(400).end(e.message);
      }
    });
  } else if (req.url === '/stats') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(Object.fromEntries(groupCounts)));
  } else {
    res.writeHead(404).end('Not Found');
  }
});

httpServer.listen(7400, () => console.log('HTTP 数据入口: http://127.0.0.1:7400/event'));

// === UDP 接收（更高吞吐）===
const udpServer = dgram.createSocket('udp4');
udpServer.on('message', (msg) => {
  try {
    const event = JSON.parse(msg.toString());
    source.emit('data', event);
  } catch (_) {}
});
udpServer.bind(7401, () => console.log('UDP 数据入口: udp://127.0.0.1:7401'));
