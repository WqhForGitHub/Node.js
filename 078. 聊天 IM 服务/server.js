// IM 服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handshake, WSConnection } = require('./ws');
const store = require('./store');

// username -> { conn, status }
const online = new Map();

function broadcastPresence(username, status) {
  const u = store.users.get(username);
  if (!u) return;
  // 通知所有好友
  u.friends.forEach((f) => {
    const friendConn = online.get(f);
    if (friendConn) friendConn.conn.send({ type: 'presence', user: username, status });
  });
}

function deliver(targetUser, msg) {
  const target = online.get(targetUser);
  if (target) {
    target.conn.send(msg);
    return true;
  }
  store.saveOffline(targetUser, msg);
  return false;
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  } else if (req.url === '/api/register' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const r = store.register(username, password);
        res.writeHead(r.ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400).end(e.message);
      }
    });
  } else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  let username = null;

  conn.on('message', (msg) => {
    if (msg.type === 'login') {
      const r = store.login(msg.username, msg.password);
      if (!r.ok) return conn.send({ type: 'login-fail', error: r.error });
      username = msg.username;
      online.set(username, { conn, status: 'online' });
      const user = r.user;
      conn.send({
        type: 'login-ok',
        user: { username, friends: user.friends, groups: user.groups },
      });
      // 发送离线消息
      const offline = store.getOffline(username);
      if (offline.length > 0) {
        conn.send({ type: 'offline-messages', messages: offline });
      }
      broadcastPresence(username, 'online');
      console.log(`${username} 登录，当前在线: ${online.size}`);
    } else if (!username) {
      return conn.send({ type: 'error', error: '请先登录' });
    } else if (msg.type === 'msg-private') {
      const m = {
        id: crypto.randomBytes(6).toString('hex'),
        type: 'msg-private',
        from: username,
        to: msg.to,
        content: msg.content,
        ts: Date.now(),
      };
      store.saveMessage(m);
      conn.send({ type: 'msg-ack', id: m.id, ts: m.ts });
      deliver(msg.to, m);
    } else if (msg.type === 'msg-group') {
      const group = store.groups.get(msg.groupId);
      if (!group || !group.members.includes(username)) return;
      const m = {
        id: crypto.randomBytes(6).toString('hex'),
        type: 'msg-group',
        from: username,
        groupId: msg.groupId,
        content: msg.content,
        ts: Date.now(),
      };
      store.saveMessage(m);
      conn.send({ type: 'msg-ack', id: m.id, ts: m.ts });
      group.members.forEach((member) => {
        if (member !== username) deliver(member, m);
      });
    } else if (msg.type === 'add-friend') {
      const r = store.addFriend(username, msg.friend);
      conn.send({ type: 'add-friend-result', ...r, friend: msg.friend });
    } else if (msg.type === 'create-group') {
      const g = store.createGroup(msg.name, username);
      conn.send({ type: 'group-created', group: g });
    } else if (msg.type === 'join-group') {
      const r = store.joinGroup(msg.groupId, username);
      conn.send({ type: 'group-joined', ...r });
    } else if (msg.type === 'history') {
      let messages;
      if (msg.with) {
        messages = store.getHistory(
          (m) =>
            m.type === 'msg-private' &&
            ((m.from === username && m.to === msg.with) ||
              (m.from === msg.with && m.to === username))
        );
      } else if (msg.groupId) {
        messages = store.getHistory((m) => m.type === 'msg-group' && m.groupId === msg.groupId);
      } else {
        messages = [];
      }
      conn.send({ type: 'history', messages, with: msg.with, groupId: msg.groupId });
    } else if (msg.type === 'typing') {
      const m = { type: 'typing', from: username, to: msg.to };
      const target = online.get(msg.to);
      if (target) target.conn.send(m);
    }
  });

  conn.on('close', () => {
    if (username) {
      online.delete(username);
      broadcastPresence(username, 'offline');
      console.log(`${username} 离线`);
    }
  });
});

server.listen(7800, () => {
  console.log('IM 聊天服务: http://127.0.0.1:7800');
});
