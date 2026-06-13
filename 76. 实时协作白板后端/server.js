// 白板服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handshake, WSConnection } = require('./ws');
const Whiteboard = require('./board');

const boards = new Map();
function getBoard(id) {
  if (!boards.has(id)) boards.set(id, new Whiteboard(id));
  return boards.get(id);
}

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  } else if (req.url.startsWith('/api/board/')) {
    const id = req.url.split('/')[3];
    const board = getBoard(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(board.snapshot()));
  } else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  const userId = crypto.randomBytes(4).toString('hex');
  const userName = `画家${userId.slice(0, 4)}`;
  const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  let board = null;

  conn.on('message', (msg) => {
    if (msg.type === 'join') {
      board = getBoard(msg.boardId);
      board.users.set(userId, {
        conn, name: userName, color: userColor, cursor: null
      });
      conn.send({
        type: 'init', userId, name: userName, color: userColor,
        snapshot: board.snapshot()
      });
      board.broadcast({
        type: 'user-join', id: userId, name: userName, color: userColor
      }, userId);
      console.log(`${userName} 加入白板 ${msg.boardId}, 在线 ${board.users.size}`);
    }
    else if (msg.type === 'op' && board) {
      board.applyOp(msg.op, userId);
      board.broadcast({ type: 'op', op: msg.op, userId }, userId);
    }
    else if (msg.type === 'cursor' && board) {
      const u = board.users.get(userId);
      if (u) u.cursor = { x: msg.x, y: msg.y };
      board.broadcast({ type: 'cursor', userId, x: msg.x, y: msg.y }, userId);
    }
  });

  conn.on('close', () => {
    if (board) {
      board.users.delete(userId);
      board.broadcast({ type: 'user-leave', id: userId });
      board.persist();
      console.log(`${userName} 离开`);
    }
  });
});

server.listen(7600, () => {
  console.log('协作白板服务: http://127.0.0.1:7600');
});
