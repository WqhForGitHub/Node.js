# 微服务架构平台 Demo

纯 Node.js 实现的微服务架构平台，零外部依赖。

## 架构图

```
                        ┌──────────────┐
                        │   客户端     │
                        └──────┬───────┘
                               │
                               ▼
                     ┌─────────────────┐
                     │   API Gateway   │ :8080
                     │  (限流/认证/    │
                     │   熔断/代理)    │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │  User    │   │  Order   │   │ Product  │
      │ Service  │   │ Service  │   │ Service  │
      │  :3001   │   │  :3002   │   │  :3003   │
      └────┬─────┘   └────┬─────┘   └────┬─────┘
           │              │              │
           └──────────────┼──────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ Service Registry │ :4000
                │ (注册/发现/心跳) │
                └──────────────────┘
```

## 快速启动

```bash
# 一键启动所有服务
node start.js
```

服务启动顺序：
1. 服务注册中心 (port 4000)
2. 用户服务 (port 3001)
3. 订单服务 (port 3002)
4. 产品服务 (port 3003)
5. API 网关 (port 8080)

## 服务说明

### 服务注册中心 (Service Registry) - :4000

| 接口 | 方法 | 说明 |
|------|------|------|
| `/register` | POST | 注册服务实例 |
| `/deregister` | POST | 注销服务实例 |
| `/heartbeat` | POST | 心跳保活 |
| `/discover/:name` | GET | 发现服务 |
| `/load-balance/:name` | GET | 负载均衡选取实例 |
| `/services` | GET | 所有服务列表 |
| `/health` | GET | 健康检查 |

### API 网关 (API Gateway) - :8080

| 特性 | 说明 |
|------|------|
| 反向代理 | 根据 URL 前缀自动路由到微服务 |
| 服务发现 | 通过注册中心动态获取服务实例 |
| 负载均衡 | 轮询策略 |
| 限流 | 60s 内最多 100 次请求 |
| 认证 | JWT Bearer Token |
| 熔断器 | 连续 5 次失败后开启熔断，30s 后半开 |

路由映射：
- `/api/users/*` → user-service
- `/api/orders/*` → order-service
- `/api/products/*` → product-service

### 用户服务 (User Service) - :3001

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/users/register` | POST | 否 | 用户注册 |
| `/api/users/login` | POST | 否 | 用户登录 |
| `/api/users` | GET | 是 | 用户列表 |
| `/api/users/:id` | GET | 是 | 用户详情（含订单） |
| `/api/users/:id` | PUT | 是 | 更新用户 |
| `/api/users/:id` | DELETE | 是 | 删除用户 |

### 订单服务 (Order Service) - :3002

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/orders` | POST | 是 | 创建订单 |
| `/api/orders` | GET | 是 | 订单列表（支持 userId 过滤） |
| `/api/orders/:id` | GET | 是 | 订单详情 |
| `/api/orders/:id/status` | PUT | 是 | 更新订单状态 |
| `/api/orders/:id` | DELETE | 是 | 取消订单 |

### 产品服务 (Product Service) - :3003

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/products` | POST | 是 | 创建产品 |
| `/api/products` | GET | 否 | 产品列表（搜索/分类/分页） |
| `/api/products/:id` | GET | 否 | 产品详情 |
| `/api/products/:id` | PUT | 是 | 更新产品 |
| `/api/products/:id/stock` | PUT | 是 | 库存变动 |
| `/api/products/:id` | DELETE | 是 | 删除产品 |

## API 调用示例

```bash
# 1. 注册用户
curl -X POST http://127.0.0.1:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"wangwu","password":"123456","nickname":"王五"}'

# 2. 登录获取 Token
curl -X POST http://127.0.0.1:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. 查看产品列表（无需认证）
curl http://127.0.0.1:8080/api/products

# 4. 搜索产品
curl "http://127.0.0.1:8080/api/products?keyword=Apple&category=电子产品"

# 5. 使用 Token 访问受保护资源
TOKEN="your-jwt-token-here"
curl http://127.0.0.1:8080/api/users \
  -H "Authorization: Bearer $TOKEN"

# 6. 创建订单
curl -X POST http://127.0.0.1:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"1","productId":"p001","quantity":2}'

# 7. 查看注册中心所有服务
curl http://127.0.0.1:4000/services
```

## 技术特性

| 特性 | 实现方式 |
|------|---------|
| 服务注册与发现 | HTTP + 内存注册表 |
| 心跳检测 | 定时心跳 + 自动剔除 |
| 负载均衡 | 轮询 / 随机 |
| API 网关 | 反向代理 + 路由匹配 |
| 认证 | JWT (HS256) |
| 限流 | 滑动窗口计数器 |
| 熔断器 | Closed → Open → Half-Open |
| 跨服务调用 | HTTP + 服务发现 |
| 优雅关闭 | SIGINT 信号处理 + 注销 |

## 文件结构

```
71. 微服务架构平台/
├── start.js                 # 一键启动脚本
├── service-registry.js      # 服务注册中心
├── api-gateway.js           # API 网关
├── common.js                # 公共模块（注册/心跳/跨服务调用/路由器）
├── services/
│   ├── user-service.js      # 用户服务
│   ├── order-service.js     # 订单服务
│   └── product-service.js   # 产品服务
├── package.json
└── README.md
```

## 预置数据

- 用户: admin/admin123, zhangsan/123456, lisi/123456
- 产品: MacBook Pro, iPhone 15 Pro, AirPods Pro 等 8 款
- 订单: 4 条示例订单
