# 72. API 聚合层（BFF）

纯 Node.js 实现的 BFF (Backend For Frontend) API 聚合层 Demo。

## 什么是 BFF？

BFF 是一种架构模式，在微服务架构中，前端不直接调用后端微服务，而是通过一个面向前端的中间层（BFF）来聚合多个后端服务的接口。BFF 的核心价值：

- **数据聚合**：一次请求获取多个后端服务的数据，前端无需多次请求
- **数据裁剪**：根据不同客户端（Web/移动端）返回不同粒度的数据
- **协议适配**：将多个微服务的不同接口风格统一为前端友好的 API
- **降级容错**：某个后端服务不可用时，仍可返回部分数据

## 架构

```
客户端 (Web)  ──┐                    ┌── 用户服务 (:5001)
                ├──> BFF 聚合层 ────┤── 订单服务 (:5002)
客户端 (Mobile) ┘    (:8080)         ├── 商品服务 (:5003)
                                     └── 库存服务 (:5004)
```

## 项目结构

```
72. API 聚合层（BFF）/
├── start.js              # 一键启动脚本
├── bff-server.js         # BFF 服务器主入口
├── aggregator.js         # 数据聚合器（核心）
├── cache.js              # 缓存层（LRU + TTL）
├── transformer.js        # 数据转换器（按客户端裁剪）
├── package.json
├── services/             # 模拟后端微服务
│   ├── user-service.js   # 用户服务 (:5001)
│   ├── order-service.js  # 订单服务 (:5002)
│   ├── product-service.js# 商品服务 (:5003)
│   └── inventory-service.js # 库存服务 (:5004)
└── routes/               # BFF 路由（按客户端区分）
    ├── web.js            # Web 端聚合路由
    └── mobile.js         # 移动端聚合路由
```

## 快速开始

```bash
# 一键启动所有服务
node start.js

# 或单独启动
node services/user-service.js      # 用户服务
node services/order-service.js     # 订单服务
node services/product-service.js   # 商品服务
node services/inventory-service.js # 库存服务
node bff-server.js                 # BFF 聚合层
```

## API 接口

### Web 端（完整数据）

| 接口 | 说明 | 聚合的后端服务 |
|------|------|---------------|
| `GET /web/homepage` | 首页数据 | 商品 + 库存 |
| `GET /web/dashboard/:userId` | 用户仪表盘 | 用户 + 订单 + 偏好 |
| `GET /web/orders/:orderId` | 订单详情 | 订单 + 用户 + 商品 + 库存 |
| `GET /web/products/:productId` | 商品详情 | 商品 + 库存 |
| `GET /web/products?category=&keyword=` | 商品列表 | 商品 + 库存 |
| `GET /web/users/:userId` | 用户详情 | 用户 + 偏好 |
| `POST /web/cache/clear` | 清除缓存 | - |

### 移动端（精简数据）

| 接口 | 说明 | 与 Web 端差异 |
|------|------|--------------|
| `GET /mobile/homepage` | 首页数据 | 精简商品信息 |
| `GET /mobile/dashboard/:userId` | 用户仪表盘 | 精简用户和订单信息 |
| `GET /mobile/orders/:orderId` | 订单详情 | 省略地址/时间线等 |
| `GET /mobile/products/:productId` | 商品详情 | 精简规格信息 |
| `GET /mobile/products?category=&keyword=` | 商品列表 | 精简列表项 |
| `GET /mobile/users/:userId` | 用户信息 | 仅 ID/名称/头像/等级 |

### 系统

| 接口 | 说明 |
|------|------|
| `GET /health` | 健康检查 + 缓存统计 |
| `GET /stats` | BFF 请求统计 |

## 测试示例

```bash
# 健康检查
curl http://127.0.0.1:8080/health

# Web 端首页
curl http://127.0.0.1:8080/web/homepage

# 移动端首页（对比数据量差异）
curl http://127.0.0.1:8080/mobile/homepage

# 用户仪表盘
curl http://127.0.0.1:8080/web/dashboard/u001
curl http://127.0.0.1:8080/mobile/dashboard/u001

# 订单详情（聚合 4 个服务的数据）
curl http://127.0.0.1:8080/web/orders/o001
curl http://127.0.0.1:8080/mobile/orders/o001

# 商品详情
curl http://127.0.0.1:8080/web/products/p001
curl http://127.0.0.1:8080/mobile/products/p001

# 商品列表（带筛选）
curl http://127.0.0.1:8080/web/products?category=electronics
curl http://127.0.0.1:8080/mobile/products?keyword=手机

# 用户详情
curl http://127.0.0.1:8080/web/users/u001
curl http://127.0.0.1:8080/mobile/users/u001

# BFF 统计
curl http://127.0.0.1:8080/stats
```

## 核心模块说明

### aggregator.js - 数据聚合器

BFF 的核心，负责：
- **并发请求**：使用 `parallel()` 同时请求多个后端服务，减少延迟
- **降级容错**：使用 `resilientGet()` 在后端服务不可用时返回 `null`，而非抛异常
- **缓存集成**：使用 `cachedGet()` 自动命中/写入缓存
- **超时控制**：每个后端请求 5 秒超时

### cache.js - 缓存层

- **LRU 淘汰**：容量满时淘汰最久未使用的缓存
- **TTL 过期**：每个缓存项有独立的过期时间
- **前缀删除**：支持按前缀批量清除缓存
- **统计信息**：命中率、缓存条目数等

### transformer.js - 数据转换器

根据不同客户端需求裁剪数据：
- **Web 端**：返回完整详细数据（地址、手机号、完整规格等）
- **移动端**：返回精简数据（仅关键字段，减少传输量）
- **嵌入模式**：用于其他聚合数据中的关联信息嵌入

## BFF vs API 网关

| 特性 | API 网关 | BFF |
|------|---------|-----|
| 定位 | 全局统一入口 | 面向特定客户端 |
| 路由方式 | 按服务前缀转发 | 按业务场景聚合 |
| 数据处理 | 透传 | 聚合/裁剪/转换 |
| 客户端感知 | 无 | 有（Web/Mobile） |
| 典型用途 | 认证/限流/路由 | 数据组装/降级 |
