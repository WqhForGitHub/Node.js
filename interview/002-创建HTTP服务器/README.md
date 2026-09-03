# 002 - 如何在 Node.js 中创建一个简单的 HTTP 服务器？

## 题目

> 如何在 Node.js 中创建一个简单的 HTTP 服务器？

## 参考答案

使用内置的 **`node:http`** 模块，核心步骤三步：

```ts
import { createServer } from 'node:http';

// 1. 创建服务器，注册请求处理函数
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Hello Node.js');
});

// 2. 监听端口
server.listen(3000, () => {
  console.log('服务器运行在 http://localhost:3000');
});
```

## 关键 API

| API                                      | 作用                                           |
| ---------------------------------------- | ---------------------------------------------- |
| `http.createServer(listener)`            | 创建服务器，`listener = (req, res) => {}`      |
| `server.listen(port, callback)`          | 监听指定端口                                   |
| `req.url` / `req.method` / `req.headers` | 请求信息（`IncomingMessage`，可读流）          |
| `res.writeHead(status, headers)`         | 写入状态码 + 响应头                            |
| `res.end(data)`                          | 发送数据并结束响应（`ServerResponse`，可写流） |
| `server.close()`                         | 停止接受新连接                                 |

## 示例代码说明（[server.ts](./server.ts)）

- 根据 `req.url` 实现了 3 条路由：`/`（JSON）、`/html`（HTML）、其他（404）
- 服务器启动后会自动用 `http.get` 请求这 3 条路由，打印状态码和响应体，然后关闭服务器（方便演示，脚本可自行退出）

## 运行示例

```bash
npm run demo:002
```

预期输出：

```
服务器已启动: http://localhost:3000

GET / -> [200] {"message":"你好，HTTP 服务器！",...}
GET /html -> [200] <h1>Hello Node.js</h1>
GET /not-exist -> [404] 404 Not Found

演示完成，服务器已关闭
```

## 常见追问

1. **Express/Koa 和原生 http 的关系？**
   它们都是对 `http.createServer` 的封装，提供中间件、路由等能力，底层完全一样。
2. **如何获取 POST 请求体？**
   `req` 是可读流，需要监听 `'data'` 聚合 chunk，`'end'` 时用 `JSON.parse` 解析；Express 里则是 `express.json()` 中间件。
3. **如何支持 HTTPS？**
   把 `http.createServer` 换成 `https.createServer({ key, cert }, listener)`，需要证书。
4. **如何优雅地处理跨域？**
   设置响应头 `Access-Control-Allow-Origin` 并响应 `OPTIONS` 预检请求。
