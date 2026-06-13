# 95. API 安全网关

纯 Node.js 实现的反向代理 + 安全网关。

## 特性
- 多路由前缀转发(`/api/xxx -> http://target`)
- 鉴权方式: `none` / `apikey` / `jwt(HS256)` / `sign(HMAC)`
- 角色 RBAC 检查
- IP 黑白名单
- SQL/XSS 注入正则检测(URL + Body)
- 请求日志记录
- 自带 JWT 签发/校验(无第三方库)

## 启动
```bash
node server.js   # http://localhost:3095
```

## 内置路由
| 前缀 | 目标 | 鉴权 |
|---|---|---|
| /api/public | http://localhost:3094 | 无 |
| /api/users  | http://localhost:3089 | API Key |
| /api/admin  | http://localhost:3090 | JWT(role=admin) |
| /api/secure | http://localhost:3091 | HMAC 签名 |

## 网关管理接口
- `GET /__gateway/health` 健康
- `GET /__gateway/logs` 最近请求
- `GET /__gateway/config` 当前配置
- `POST /__gateway/token` 生成测试 JWT `{user, role}`

## 鉴权示例

### API Key
```bash
curl -H "X-API-Key: demo-key-123" http://localhost:3095/api/users/recommend/popular
```

### JWT
```bash
TOKEN=$(curl -s -X POST http://localhost:3095/__gateway/token \
  -H "Content-Type: application/json" \
  -d '{"user":"alice","role":"admin"}' | grep -o '"[a-zA-Z0-9._-]*"' | tail -1 | tr -d '"')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3095/api/admin/rules
```

### HMAC 签名
```js
// 客户端伪代码
const ts = Date.now();
const sign = hmacSha256('shared-sign-secret', ts + path + body);
// 头: X-Timestamp: ts, X-Sign: sign
```
