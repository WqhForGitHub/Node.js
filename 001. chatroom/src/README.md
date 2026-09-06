# WebSocket 聊天室

## 架构分工

| 端     | 文件                     | 职责                                      |
| ------ | ------------------------ | ----------------------------------------- |
| 服务端 | [server.ts](server.ts)   | 接收消息、广播转发，**不做任何渲染**      |
| 客户端 | [index.html](index.html) | 收到广播后调用 `renderMessage()` 渲染页面 |

## 消息链路

```
浏览器 ws.send(JSON)
  → 服务端 ws.on('message') 解析 rawData
  → broadcast() 遍历所有在线客户端转发
  → 各浏览器 ws.onmessage 接收
  → renderMessage(data) 渲染到聊天框
```

## 易混淆点

- `ws.on('message')`：**服务端**写法，负责收消息并转发
- `ws.onmessage`：**浏览器客户端**写法，负责接收广播并渲染 UI

即：渲染只发生在每个浏览器里，服务端只是中转站。

## 运行

```bash
pnpm start   # tsc 编译 + node dist/src/server.js
# 打开 http://localhost:3001，多开几个标签页即可看到广播效果
```
