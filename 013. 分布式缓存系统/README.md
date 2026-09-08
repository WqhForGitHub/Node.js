# 86. 分布式缓存系统

纯 Node.js 实现的分布式缓存，多节点 + LRU + TTL + 一致性哈希路由。

## 架构

```
            一致性哈希环
Client ─────┬───> Node 7600
            ├───> Node 7601
            └───> Node 7602
```

## 文件

- `hash.js` - 一致性哈希环（虚拟节点、二分查找）
- `lru.js` - LRU + TTL 单机缓存
- `node.js` - 缓存节点（TCP 服务器）
- `client.js` - 客户端 + 演示

## 启动

```bash
# 启动 3 个节点（在不同终端）
node node.js 7600 7601,7602
node node.js 7601 7600,7602
node node.js 7602 7600,7601

# 运行客户端演示
node client.js
```

## 协议

TCP 上的换行分隔 JSON：
- `get` - 读取
- `set` - 写入（支持 ttl, replicate）
- `del` - 删除
- `stats` - 节点统计
- `ping` - 心跳
