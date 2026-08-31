// 内存数据库 TCP 服务器 + AOF 持久化
const net = require('net');
const { Database } = require('./engine');
const AOF = require('./aof');

const PORT = 7700;
const db = new Database();
const aof = new AOF();

// 命令执行器（写命令会经过 AOF）
function execute(cmd, fromReplay = false) {
  switch (cmd.op) {
    case 'createTable': {
      db.createTable(cmd.name, cmd.schema || {});
      if (!fromReplay) aof.append(cmd);
      return { ok: true };
    }
    case 'dropTable': {
      const ok = db.dropTable(cmd.name);
      if (!fromReplay) aof.append(cmd);
      return { ok };
    }
    case 'insert': {
      const row = db.table(cmd.table).insert(cmd.row);
      if (!fromReplay) aof.append(cmd);
      return { ok: true, row };
    }
    case 'update': {
      const row = db.table(cmd.table).update(cmd.pk, cmd.patch);
      if (!fromReplay) aof.append(cmd);
      return { ok: !!row, row };
    }
    case 'delete': {
      const ok = db.table(cmd.table).delete(cmd.pk);
      if (!fromReplay) aof.append(cmd);
      return { ok };
    }
    case 'get': {
      const row = db.table(cmd.table).get(cmd.pk);
      return { ok: true, row: row || null };
    }
    case 'find': {
      const rows = db.table(cmd.table).find(cmd.where || {}, cmd.options || {});
      return { ok: true, rows };
    }
    case 'tables': {
      return {
        ok: true,
        tables: [...db.tables.keys()].map((n) => ({
          name: n,
          count: db.table(n).count(),
        })),
      };
    }
    default:
      throw new Error('unknown op: ' + cmd.op);
  }
}

// 回放 AOF
console.log('回放 AOF...');
const replayed = aof.replay((cmd) => execute(cmd, true));
console.log(`已回放 ${replayed} 条命令`);

const server = net.createServer((socket) => {
  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const resp = execute(JSON.parse(line));
        socket.write(JSON.stringify(resp) + '\n');
      } catch (e) {
        socket.write(JSON.stringify({ ok: false, error: e.message }) + '\n');
      }
    }
  });
  socket.on('error', () => {});
});

server.listen(PORT, () => console.log(`内存数据库: tcp://127.0.0.1:${PORT}`));
process.on('SIGINT', () => {
  aof.close();
  server.close();
  process.exit(0);
});
