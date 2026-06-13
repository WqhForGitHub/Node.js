# 78. 聊天 IM 服务

类微信/QQ 的即时通讯服务，纯 Node.js 实现。

## 功能

- 用户注册/登录（密码 SHA-256）
- 一对一私聊
- 群组聊天
- 在线状态广播
- "正在输入"提示
- 离线消息缓存
- 历史消息查询
- 消息持久化（JSON）

## 文件

- `ws.js` - WebSocket 协议
- `store.js` - 数据存储（用户、消息、群组）
- `server.js` - IM 服务器
- `client.html` - 聊天前端

## 运行

```bash
node server.js
```

访问 `http://127.0.0.1:7800/`，注册多个账号在不同窗口登录测试。

## 协议

```
client -> server:
  { type: 'login', username, password }
  { type: 'msg-private', to, content }
  { type: 'msg-group', groupId, content }
  { type: 'add-friend', friend }
  { type: 'create-group', name }
  { type: 'join-group', groupId }
  { type: 'history', with | groupId }
  { type: 'typing', to }

server -> client:
  { type: 'login-ok'|'login-fail', user, error? }
  { type: 'msg-private'|'msg-group', from, content, ts }
  { type: 'msg-ack', id, ts }
  { type: 'presence', user, status }
  { type: 'offline-messages', messages }
  { type: 'history', messages }
  { type: 'typing', from }
```
