# 80. 推送通知网关

类 FCM/APNs/极光推送的通知网关，纯 Node.js 实现。

## 架构

```
业务方  ──HTTP API──▶  [推送网关]  ──WebSocket──▶ 设备
                          │
                          ├── 设备注册表
                          ├── 主题订阅
                          ├── 离线消息队列
                          └── QoS 重传
```

## 功能

- **设备注册**：deviceId + userId + platform
- **多种目标**：广播、按设备、按用户、按主题
- **主题订阅**：发布/订阅模式
- **离线消息**：每设备最多 100 条
- **QoS 0/1**：at-most-once / at-least-once（带 ack 重试 3 次）
- **API 鉴权**：X-API-Token 头
- **管理台**：实时指标、设备列表、推送测试
- **持久化**：JSON 文件

## 文件

- `ws.js` - WebSocket 协议
- `gateway.js` - 推送核心引擎
- `server.js` - HTTP + WS 服务器
- `client.html` - 设备客户端
- `admin.html` - 管理台
- `sample-push.js` - 业务方调用示例

## 运行

```bash
node server.js
```

- 设备端：`http://127.0.0.1:8000/`
- 管理台：`http://127.0.0.1:8000/admin`
- 调用示例：`node sample-push.js`

## REST API

```
POST /api/push
Headers: X-API-Token: demo-token-12345
Body: {
  "target": "broadcast" | "topic" | "user" | "device",
  "topic": "news",         // target=topic 时
  "userId": "alice",       // target=user 时
  "deviceId": "...",       // target=device 时
  "payload": { "title": "...", "body": "...", "data": {...} },
  "qos": 0 | 1
}
```

## WebSocket 协议

```
client -> server:
  { type: 'register', deviceId, userId, platform }
  { type: 'subscribe', topic }
  { type: 'ack', msgId }
  { type: 'ping' }

server -> client:
  { type: 'registered', deviceId }
  { type: 'subscribed', topic }
  { type: 'push', id, title, body, data, qos, ts }
  { type: 'pong', t }
```
