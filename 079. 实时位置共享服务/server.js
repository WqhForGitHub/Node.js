// 位置共享服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handshake, WSConnection } = require('./ws');
const { GeoIndex, haversine } = require('./geo');

const geo = new GeoIndex();
const users = new Map();   // userId -> { conn, name, group, lastUpdate }
const groups = new Map();  // groupId -> Set(userId)

function joinGroup(userId, groupId) {
  const u = users.get(userId);
  if (!u) return;
  if (u.group) leaveGroup(userId);
  u.group = groupId;
  if (!groups.has(groupId)) groups.set(groupId, new Set());
  groups.get(groupId).add(userId);
}

function leaveGroup(userId) {
  const u = users.get(userId);
  if (!u || !u.group) return;
  const g = groups.get(u.group);
  if (g) {
    g.delete(userId);
    if (g.size === 0) groups.delete(u.group);
  }
  u.group = null;
}

function broadcastToGroup(groupId, msg, exceptId) {
  const g = groups.get(groupId);
  if (!g) return;
  for (const uid of g) {
    if (uid === exceptId) continue;
    const u = users.get(uid);
    if (u) u.conn.send(msg);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  } else if (req.url.startsWith('/api/nearby')) {
    const u = new URL(req.url, 'http://x');
    const lat = parseFloat(u.searchParams.get('lat'));
    const lon = parseFloat(u.searchParams.get('lon'));
    const r = parseFloat(u.searchParams.get('r') || '1000');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(geo.nearby(lat, lon, r)));
  } else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  const userId = crypto.randomBytes(4).toString('hex');
  let userName = null;

  conn.on('message', (msg) => {
    if (msg.type === 'join') {
      userName = msg.name || `用户${userId.slice(0,4)}`;
      users.set(userId, { conn, name: userName, group: null, lastUpdate: Date.now() });
      if (msg.group) joinGroup(userId, msg.group);
      conn.send({ type: 'joined', userId, group: msg.group });
      console.log(`${userName} 加入${msg.group ? ' 群组 ' + msg.group : ''}`);
    }
    else if (msg.type === 'location') {
      if (!userName) return;
      geo.upsert(userId, msg.lat, msg.lon);
      const u = users.get(userId);
      u.lastUpdate = Date.now();
      if (u.group) {
        broadcastToGroup(u.group, {
          type: 'location-update',
          userId, name: userName,
          lat: msg.lat, lon: msg.lon,
          accuracy: msg.accuracy, speed: msg.speed,
          ts: Date.now()
        }, userId);
      }
    }
    else if (msg.type === 'nearby') {
      const results = geo.nearby(msg.lat, msg.lon, msg.radius || 1000);
      conn.send({
        type: 'nearby-result',
        users: results.map(r => ({ ...r, name: users.get(r.userId)?.name || 'unknown' }))
      });
    }
    else if (msg.type === 'group-snapshot') {
      const u = users.get(userId);
      if (!u || !u.group) return;
      const list = [];
      const g = groups.get(u.group);
      if (g) {
        for (const uid of g) {
          const loc = geo.get(uid);
          const usr = users.get(uid);
          if (loc && usr) {
            list.push({ userId: uid, name: usr.name, lat: loc.lat, lon: loc.lon, ts: loc.ts });
          }
        }
      }
      conn.send({ type: 'group-snapshot', members: list });
    }
  });

  conn.on('close', () => {
    if (userName) {
      const u = users.get(userId);
      if (u && u.group) {
        broadcastToGroup(u.group, { type: 'user-leave', userId, name: userName }, userId);
      }
      leaveGroup(userId);
      geo.remove(userId);
      users.delete(userId);
      console.log(`${userName} 离开`);
    }
  });
});

// 清理超时（5 分钟无更新）
setInterval(() => {
  const now = Date.now();
  for (const [, u] of users) {
    if (now - u.lastUpdate > 5 * 60 * 1000) {
      try { u.conn.close(); } catch (_) {}
    }
  }
}, 60000);

server.listen(7900, () => {
  console.log('位置共享服务: http://127.0.0.1:7900');
});
