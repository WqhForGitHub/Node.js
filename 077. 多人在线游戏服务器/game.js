// 游戏世界 - 简易 2D Top-Down 多人射击
const WORLD = { width: 1200, height: 800 };
const TICK_RATE = 30; // 每秒 30 次状态广播
const PLAYER_SPEED = 200; // 像素/秒
const BULLET_SPEED = 500;
const BULLET_LIFE = 1500; // ms
const PLAYER_RADIUS = 16;
const BULLET_RADIUS = 4;
const RESPAWN_TIME = 3000;

class GameWorld {
  constructor() {
    this.players = new Map(); // id -> player
    this.bullets = []; // 子弹列表
    this.lastUpdate = Date.now();
  }

  addPlayer(id, name) {
    const player = {
      id,
      name,
      x: Math.random() * WORLD.width,
      y: Math.random() * WORLD.height,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      score: 0,
      kills: 0,
      deaths: 0,
      alive: true,
      lastShot: 0,
      input: { up: false, down: false, left: false, right: false },
    };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  setInput(id, input) {
    const p = this.players.get(id);
    if (!p) return;
    p.input = { ...p.input, ...input };
    if (input.angle !== undefined) p.angle = input.angle;
  }

  shoot(id) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const now = Date.now();
    if (now - p.lastShot < 250) return; // 冷却
    p.lastShot = now;
    this.bullets.push({
      ownerId: id,
      x: p.x + Math.cos(p.angle) * PLAYER_RADIUS,
      y: p.y + Math.sin(p.angle) * PLAYER_RADIUS,
      vx: Math.cos(p.angle) * BULLET_SPEED,
      vy: Math.sin(p.angle) * BULLET_SPEED,
      bornAt: now,
    });
  }

  update() {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // 更新玩家
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (now - p.deathTime > RESPAWN_TIME) {
          p.alive = true;
          p.hp = 100;
          p.x = Math.random() * WORLD.width;
          p.y = Math.random() * WORLD.height;
        }
        continue;
      }
      let vx = 0,
        vy = 0;
      if (p.input.up) vy -= 1;
      if (p.input.down) vy += 1;
      if (p.input.left) vx -= 1;
      if (p.input.right) vx += 1;
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len;
        vy /= len;
      }
      p.x += vx * PLAYER_SPEED * dt;
      p.y += vy * PLAYER_SPEED * dt;
      // 边界
      p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD.width - PLAYER_RADIUS, p.x));
      p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD.height - PLAYER_RADIUS, p.y));
    }

    // 更新子弹
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (now - b.bornAt > BULLET_LIFE) return false;
      if (b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) return false;
      // 碰撞检测
      for (const p of this.players.values()) {
        if (p.id === b.ownerId || !p.alive) continue;
        const dx = p.x - b.x,
          dy = p.y - b.y;
        if (dx * dx + dy * dy < (PLAYER_RADIUS + BULLET_RADIUS) ** 2) {
          p.hp -= 25;
          if (p.hp <= 0) {
            p.alive = false;
            p.deathTime = now;
            p.deaths++;
            const owner = this.players.get(b.ownerId);
            if (owner) {
              owner.score += 10;
              owner.kills++;
            }
          }
          return false;
        }
      }
      return true;
    });
  }

  snapshot() {
    return {
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: +p.angle.toFixed(2),
        hp: p.hp,
        alive: p.alive,
        score: p.score,
        kills: p.kills,
        deaths: p.deaths,
      })),
      bullets: this.bullets.map((b) => ({
        x: Math.round(b.x),
        y: Math.round(b.y),
        owner: b.ownerId,
      })),
    };
  }
}

module.exports = { GameWorld, TICK_RATE, WORLD };
