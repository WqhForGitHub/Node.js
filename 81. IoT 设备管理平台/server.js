// IoT 平台服务器 - HTTP 管理 API + TCP 设备接入
const http = require('http');
const net = require('net');
const url = require('url');
const DeviceRegistry = require('./registry');

const HTTP_PORT = 7100;
const TCP_PORT = 7101;
const registry = new DeviceRegistry();

// 命令下发队列（按设备 ID）
const commandQueue = new Map();
// 在线 socket 映射
const sockets = new Map();
// 遥测数据缓存（最近 100 条）
const telemetry = new Map();

function pushTelemetry(deviceId, data) {
  if (!telemetry.has(deviceId)) telemetry.set(deviceId, []);
  const arr = telemetry.get(deviceId);
  arr.push({ ts: Date.now(), data });
  if (arr.length > 100) arr.shift();
}

// ========== TCP 设备接入 ==========
const tcpServer = net.createServer((socket) => {
  let deviceId = null;
  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        handleDeviceMessage(socket, msg, (id) => { deviceId = id; });
      } catch (e) {
        socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
      }
    }
  });

  socket.on('close', () => {
    if (deviceId) {
      sockets.delete(deviceId);
      registry.markOffline(deviceId);
      console.log(`设备离线: ${deviceId}`);
    }
  });
  socket.on('error', () => {});
});

function handleDeviceMessage(socket, msg, setId) {
  switch (msg.type) {
    case 'register': {
      const d = registry.register(msg.id, msg.info || {});
      sockets.set(msg.id, socket);
      setId(msg.id);
      console.log(`设备注册: ${msg.id} (${d.type})`);
      socket.write(JSON.stringify({ ok: true, type: 'registered' }) + '\n');
      // 推送队列中的命令
      flushCommands(msg.id);
      break;
    }
    case 'heartbeat': {
      registry.heartbeat(msg.id);
      socket.write(JSON.stringify({ ok: true, type: 'pong' }) + '\n');
      break;
    }
    case 'telemetry': {
      pushTelemetry(msg.id, msg.data);
      registry.heartbeat(msg.id);
      socket.write(JSON.stringify({ ok: true, type: 'ack' }) + '\n');
      break;
    }
    default:
      socket.write(JSON.stringify({ ok: false, error: 'unknown type' }) + '\n');
  }
}

function flushCommands(deviceId) {
  const sock = sockets.get(deviceId);
  const queue = commandQueue.get(deviceId);
  if (!sock || !queue || queue.length === 0) return;
  while (queue.length) {
    const cmd = queue.shift();
    sock.write(JSON.stringify({ type: 'command', cmd }) + '\n');
  }
}

function sendCommand(deviceId, cmd) {
  if (!commandQueue.has(deviceId)) commandQueue.set(deviceId, []);
  commandQueue.get(deviceId).push(cmd);
  flushCommands(deviceId);
}

// ========== HTTP 管理 API ==========
const httpServer = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json');

  // GET /devices
  if (req.method === 'GET' && u.pathname === '/devices') {
    res.end(JSON.stringify(registry.list(u.query)));
    return;
  }
  // GET /devices/:id
  const m = u.pathname.match(/^\/devices\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const d = registry.get(m[1]);
    if (!d) { res.statusCode = 404; res.end('{"error":"not found"}'); return; }
    res.end(JSON.stringify(d));
    return;
  }
  // GET /devices/:id/telemetry
  const tm = u.pathname.match(/^\/devices\/([^/]+)\/telemetry$/);
  if (req.method === 'GET' && tm) {
    res.end(JSON.stringify(telemetry.get(tm[1]) || []));
    return;
  }
  // POST /devices/:id/command  body: {action, params}
  const cm = u.pathname.match(/^\/devices\/([^/]+)\/command$/);
  if (req.method === 'POST' && cm) {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const cmd = JSON.parse(body);
        sendCommand(cm[1], cmd);
        res.end(JSON.stringify({ ok: true, queued: !sockets.has(cm[1]) }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  // DELETE /devices/:id
  if (req.method === 'DELETE' && m) {
    res.end(JSON.stringify({ ok: registry.remove(m[1]) }));
    return;
  }

  res.statusCode = 404;
  res.end('{"error":"not found"}');
});

// 定期检查超时设备
setInterval(() => {
  const n = registry.reapStale(30000);
  if (n > 0) console.log(`标记 ${n} 个超时设备为离线`);
}, 10000);

httpServer.listen(HTTP_PORT, () => console.log(`HTTP 管理 API: http://127.0.0.1:${HTTP_PORT}`));
tcpServer.listen(TCP_PORT, () => console.log(`TCP 设备接入: tcp://127.0.0.1:${TCP_PORT}`));

process.on('SIGINT', () => {
  console.log('\n关闭服务...');
  registry.save();
  httpServer.close();
  tcpServer.close();
  process.exit(0);
});
