# URL 短链服务

纯 Node.js 实现，无任何第三方依赖。

## 快速开始

```bash
npm start        # 启动服务（默认端口 3000）
npm run dev      # 开发模式（文件变更自动重启，需 Node 18+）
```

自定义端口：

```bash
PORT=8080 node server.js
```

## API 接口

### 1. 创建短链

```
POST /shorten
Content-Type: application/json

{ "url": "https://example.com/very/long/url" }
```

响应：

```json
{
  "shortUrl": "http://localhost:3000/1",
  "code": "1",
  "originalUrl": "https://example.com/very/long/url",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "isNew": true
}
```

### 2. 访问短链（302 重定向）

```
GET /:code
```

浏览器访问短链地址，自动跳转到原始 URL。

### 3. 查看短链信息

```
GET /info/:code
```

```json
{
  "code": "1",
  "originalUrl": "https://example.com/very/long/url",
  "visits": 5,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### 4. 列出所有短链

```
GET /list
```

### 5. 删除短链

```
DELETE /:code
```

## 测试示例

```bash
# 创建短链
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com"}'

# 访问短链（跟随重定向）
curl -L http://localhost:3000/1

# 查看信息
curl http://localhost:3000/info/1

# 列出所有
curl http://localhost:3000/list

# 删除
curl -X DELETE http://localhost:3000/1
```

## 项目结构

```
09. URL 短链服务/
├── server.js      # HTTP 服务器与路由
├── store.js       # 数据持久化（JSON 文件）
├── shortCode.js   # Base62 编码生成短码
├── package.json
└── data.json      # 运行时自动生成
```

## 核心设计

- **短码生成**：自增 ID → Base62 编码，1→`1`，100→`1C`，紧凑无碰撞
- **去重**：相同 URL 返回已有短码，不会重复创建
- **持久化**：JSON 文件存储，重启不丢数据
- **访问统计**：每次重定向自动 +1 访问计数
