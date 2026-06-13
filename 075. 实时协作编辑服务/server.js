// 协同编辑服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handshake, WSConnection } = require('./ws');
const { transform, applyOp } = require('./ot');

class Document {
  constructor(id) {
    this.id = id;
    this.content = '';
    this.version = 0;
    this.history = []; // 已应用的操作历史
    this.users = new Map(); // userId -> { conn, name, color, cursor }
  }

  apply(op, fromVersion) {
    // 将 op 与从 fromVersion 之后所有操作做转换
    let transformed = op;
    for (let i = fromVersion; i < this.history.length; i++) {
      transformed = transform(transformed, this.history[i]);
    }
    this.content = applyOp(this.content, transformed);
    this.history.push(transformed);
    this.version = this.history.length;
    return transformed;
  }

  broadcast(msg, exceptId) {
    for (const [uid, user] of this.users) {
      if (uid !== exceptId) user.conn.send(msg);
    }
  }
}

const docs = new Map();
function getDoc(id) {
  if (!docs.has(id)) docs.set(id, new Document(id));
  return docs.get(id);
}

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  } else if (req.url.startsWith('/doc/')) {
    const id = req.url.split('/')[2];
    const doc = getDoc(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: doc.content, version: doc.version }));
  } else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  const userId = crypto.randomBytes(4).toString('hex');
  const userName = `用户${userId.slice(0, 4)}`;
  const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  let currentDoc = null;

  conn.on('message', (msg) => {
    if (msg.type === 'join') {
      currentDoc = getDoc(msg.docId);
      currentDoc.users.set(userId, {
        conn, name: userName, color: userColor, cursor: 0
      });
      // 发送初始状态
      conn.send({
        type: 'init',
        userId,
        name: userName,
        color: userColor,
        content: currentDoc.content,
        version: currentDoc.version,
        users: [...currentDoc.users].map(([id, u]) => ({
          id, name: u.name, color: u.color, cursor: u.cursor
        }))
      });
      // 通知其他人
      currentDoc.broadcast({
        type: 'user-join', id: userId, name: userName, color: userColor
      }, userId);
      console.log(`${userName} 加入文档 ${msg.docId}`);
    }
    else if (msg.type === 'op' && currentDoc) {
      const transformed = currentDoc.apply(msg.op, msg.version);
      conn.send({
        type: 'ack', version: currentDoc.version, op: transformed
      });
      currentDoc.broadcast({
        type: 'op', op: transformed, version: currentDoc.version, userId
      }, userId);
    }
    else if (msg.type === 'cursor' && currentDoc) {
      const user = currentDoc.users.get(userId);
      if (user) user.cursor = msg.pos;
      currentDoc.broadcast({
        type: 'cursor', userId, pos: msg.pos
      }, userId);
    }
  });

  conn.on('close', () => {
    if (currentDoc) {
      currentDoc.users.delete(userId);
      currentDoc.broadcast({ type: 'user-leave', id: userId });
      console.log(`${userName} 离开`);
    }
  });
});

server.listen(7500, () => {
  console.log('实时协作编辑服务: http://127.0.0.1:7500');
  console.log('在多个浏览器窗口打开同一 URL 即可协同编辑');
});
