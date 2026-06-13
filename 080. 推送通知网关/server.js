// 推送网关服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handshake, WSConnection } = require('./ws');
const Gateway = require('./gateway');

const gateway = new Gateway();

// API Token 校验（业务方推送时使用）
const API_TOKEN = 'demo-token-12345';

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path0 = url.pathname;

  if (path0 === '/' || path0 === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  }
  else if (path0 === '/admin' || path0 === '/admin.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'admin.html')));
  }
  else if (path0 === '/api/push' && req.method === 'POST') {
    if (req.headers['x-api-token'] !== API_TOKEN) {
      return res.writeHead(401).end('Unauthorized');
    }
    try {
      const { target, deviceId, userId, topic, payload, qos } = await readJson(req);
      let count = 0;
      if (target === 'device') count = gateway.pushToDevice(deviceId, payload, { qos }) ? 1 : 0;
      else if (target === 'user') count = gateway.pushToUser(userId, payload, { qos });
      else if (target === 'topic') count = gateway.pushToTopic(topic, payload, { qos });
      else if (target === 'broadcast') count = gateway.broadcast(payload, { qos });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, delivered: count }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }
  else if (path0 === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(gateway.stats()));
  }
  else if (path0 === '/api/devices') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([...gateway.devices.values()].map(d => ({
      deviceId: d.deviceId, userId: d.userId, platform: d.platform,
      topics: d.topics, online: gateway.online.has(d.deviceId),
      offlineCount: d.offline.length
    }))));
  }
  else if (path0 === '/api/topics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([...gateway.topics].map(([t, s]) => ({
      topic: t, subscribers: s.size
    }))));
  }
  else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  let deviceId = null;

  conn.on('message', (msg) => {
    if (msg.type === 'register') {
      deviceId = msg.deviceId;
      gateway.registerDevice(deviceId, msg.userId, msg.platform || 'web');
      gateway.setOnline(deviceId, conn);
      conn.send({ type: 'registered', deviceId });
      console.log(`设备注册: ${deviceId} (用户 ${msg.userId})`);
    }
    else if (msg.type === 'subscribe') {
      gateway.subscribe(deviceId, msg.topic);
      conn.send({ type: 'subscribed', topic: msg.topic });
    }
    else if (msg.type === 'unsubscribe') {
      gateway.unsubscribe(deviceId, msg.topic);
    }
    else if (msg.type === 'ack') {
      gateway.ack(msg.msgId);
    }
    else if (msg.type === 'ping') {
      conn.send({ type: 'pong', t: Date.now() });
    }
  });

  conn.on('close', () => {
    if (deviceId) {
      gateway.setOffline(deviceId);
      console.log(`设备离线: ${deviceId}`);
    }
  });
});

// 心跳超时检查（30 秒无活动断开）
// 这里简化省略

server.listen(8000, () => {
  console.log('推送通知网关: http://127.0.0.1:8000');
  console.log('  设备端: http://127.0.0.1:8000/');
  console.log('  管理台: http://127.0.0.1:8000/admin');
  console.log('  API Token: ' + API_TOKEN);
});

process.on('SIGINT', () => {
  gateway.save();
  process.exit(0);
});
