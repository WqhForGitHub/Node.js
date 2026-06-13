# 76. 实时协作白板后端

支持多人同时绘画的协作白板服务，纯 Node.js + 原生 WebSocket。

## 功能

- 画笔、矩形、圆形工具
- 多颜色选择
- 删除/清空
- 实时光标位置同步
- 用户在线列表
- 房间隔离（URL #boardId）
- JSON 文件持久化

## 文件

- `ws.js` - WebSocket 协议
- `board.js` - 白板房间数据模型
- `server.js` - HTTP+WS 服务器
- `client.html` - 画板前端

## 运行

```bash
node server.js
```

访问 `http://127.0.0.1:7600/#myBoard`

## 协议

```
client -> server:
  { type: 'join', boardId }
  { type: 'op', op: { kind: 'add'|'update'|'delete'|'clear', shape, shapeId } }
  { type: 'cursor', x, y }

server -> client:
  { type: 'init', userId, snapshot }
  { type: 'op', op, userId }
  { type: 'cursor', userId, x, y }
  { type: 'user-join'|'user-leave', ... }
```
