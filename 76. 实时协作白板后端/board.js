// 白板房间 - 管理图形对象与历史
const fs = require('fs');
const path = require('path');

class Whiteboard {
  constructor(id) {
    this.id = id;
    this.shapes = new Map(); // shapeId -> shape
    this.users = new Map();  // userId -> { conn, name, color, cursor }
    this.history = [];       // 操作历史（用于撤销/重做）
    this.persistFile = path.join(__dirname, `board-${id}.json`);
    this.load();
  }

  applyOp(op, fromUser) {
    // op: { kind: 'add'|'update'|'delete'|'clear', shape?, shapeId? }
    switch (op.kind) {
      case 'add':
        this.shapes.set(op.shape.id, op.shape);
        break;
      case 'update':
        if (this.shapes.has(op.shape.id)) {
          this.shapes.set(op.shape.id, { ...this.shapes.get(op.shape.id), ...op.shape });
        }
        break;
      case 'delete':
        this.shapes.delete(op.shapeId);
        break;
      case 'clear':
        this.shapes.clear();
        break;
    }
    this.history.push({ op, user: fromUser, ts: Date.now() });
    if (this.history.length % 20 === 0) this.persist();
  }

  snapshot() {
    return {
      shapes: [...this.shapes.values()],
      users: [...this.users].map(([id, u]) => ({
        id, name: u.name, color: u.color, cursor: u.cursor
      }))
    };
  }

  broadcast(msg, exceptId) {
    for (const [uid, u] of this.users) {
      if (uid !== exceptId) u.conn.send(msg);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.persistFile, JSON.stringify({
        shapes: [...this.shapes.values()]
      }));
    } catch (_) {}
  }

  load() {
    if (!fs.existsSync(this.persistFile)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.persistFile, 'utf8'));
      (data.shapes || []).forEach(s => this.shapes.set(s.id, s));
      console.log(`白板 ${this.id} 已加载 ${this.shapes.size} 个图形`);
    } catch (_) {}
  }
}

module.exports = Whiteboard;
