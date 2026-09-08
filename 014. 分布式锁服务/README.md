# 分布式锁服务 (Distributed Lock Service)

纯 Node.js 实现的分布式锁服务，无任何第三方依赖。

## 功能特性

- **互斥锁 (Mutex)**: 同一时刻只有一个客户端持有锁
- **读写锁 (RWLock)**: 多读者并发，写者独占
- **TTL 自动过期**: 防止客户端崩溃导致死锁
- **锁续期 (Lease Renewal)**: 长任务可主动续期
- **可重入锁 (Reentrant)**: 同一客户端可多次获取
- **公平队列 (FIFO)**: 等待者按顺序获得锁
- **Fencing Token**: 唯一递增令牌，防止过期客户端误操作
- **阻塞获取**: 支持超时等待

## 文件结构

- [server.js](./server.js) - 锁服务端 (HTTP API)
- [client.js](./client.js) - 客户端 SDK 与演示

## 启动

```bash
# 终端 1: 启动服务
node server.js

# 终端 2: 运行客户端演示
node client.js
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /lock/acquire | 获取互斥锁（支持阻塞） |
| POST | /lock/release | 释放互斥锁（需 token） |
| POST | /lock/renew | 锁续期 |
| POST | /rwlock/acquire-read | 获取读锁 |
| POST | /rwlock/acquire-write | 获取写锁 |
| POST | /rwlock/release | 释放读写锁 |
| GET  | /status | 查看所有锁状态 |
| GET  | /health | 健康检查 |

## 示例请求

```bash
# 获取锁
curl -X POST http://localhost:3097/lock/acquire \
  -H "Content-Type: application/json" \
  -d '{"key":"order:1001","clientId":"app-1","ttl":30000}'

# 释放锁（必须传入返回的 token）
curl -X POST http://localhost:3097/lock/release \
  -H "Content-Type: application/json" \
  -d '{"key":"order:1001","clientId":"app-1","token":1}'
```

## 设计要点

1. **Fencing Token**: 每次获取锁返回递增 token，释放/续期必须携带，防止 GC 暂停后的过期客户端误操作。
2. **TTL 清理**: 后台 1 秒一次扫描过期锁，自动唤醒等待者。
3. **公平锁**: 等待者按 FIFO 加入队列，避免饥饿。
4. **可重入计数**: 同一 clientId 多次获取计数加 1，必须释放相同次数才完全解锁。
