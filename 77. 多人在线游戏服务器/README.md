# 77. 多人在线游戏服务器

纯 Node.js 实现的 2D Top-Down 多人射击游戏，权威服务器架构。

## 特性

- **权威服务器**：所有物理在服务器计算，防作弊
- **60 FPS 游戏循环** + **30 Hz 状态广播**
- **碰撞检测**：圆形碰撞（玩家 vs 子弹）
- **重生机制**：3 秒后随机位置复活
- **排行榜**：实时分数/击杀/死亡
- **相机跟随**：玩家居中视角

## 文件

- `ws.js` - WebSocket 协议
- `game.js` - 游戏世界（玩家、子弹、物理、碰撞）
- `server.js` - 服务端
- `client.html` - 浏览器游戏客户端

## 运行

```bash
node server.js
```

访问 `http://127.0.0.1:7700/`，多窗口打开即可联机对战。

## 操作

- WASD / 方向键：移动
- 鼠标：瞄准
- 左键：射击（250ms 冷却）

## 协议

```
client -> server:
  { type: 'join', name }
  { type: 'input', input: { up, down, left, right, angle } }
  { type: 'shoot' }

server -> client:
  { type: 'init', id, world }
  { type: 'state', snap: { players, bullets }, t }   // 30 Hz
```
