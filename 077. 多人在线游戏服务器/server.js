// 游戏服务器
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handshake, WSConnection } = require('./ws');
const { GameWorld, TICK_RATE, WORLD } = require('./game');

const world = new GameWorld();
const connections = new Map(); // id -> conn

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'client.html')));
  } else {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket) => {
  handshake(req, socket);
  const conn = new WSConnection(socket);
  const id = crypto.randomBytes(4).toString('hex');
  let joined = false;

  conn.on('message', (msg) => {
    if (msg.type === 'join') {
      const name = (msg.name || `玩家${id.slice(0, 4)}`).slice(0, 12);
      world.addPlayer(id, name);
      connections.set(id, conn);
      joined = true;
      conn.send({ type: 'init', id, world: WORLD });
      console.log(`${name} 加入游戏，当前 ${world.players.size} 人`);
    } else if (msg.type === 'input') {
      world.setInput(id, msg.input);
    } else if (msg.type === 'shoot') {
      world.shoot(id);
    }
  });

  conn.on('close', () => {
    if (joined) {
      world.removePlayer(id);
      connections.delete(id);
      console.log(`玩家 ${id} 离开`);
    }
  });
});

// 游戏主循环
setInterval(() => world.update(), 1000 / 60); // 60 FPS 物理

// 状态广播
setInterval(() => {
  const snap = world.snapshot();
  const msg = { type: 'state', snap, t: Date.now() };
  for (const conn of connections.values()) conn.send(msg);
}, 1000 / TICK_RATE);

server.listen(7700, () => {
  console.log('多人游戏服务器: http://127.0.0.1:7700');
});
