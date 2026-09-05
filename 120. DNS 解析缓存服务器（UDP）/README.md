# 120. DNS 解析缓存服务器（UDP）

一个**明文协议**的 DNS 解析缓存服务，演示如何在 UDP 上实现"先查缓存、未命中再用 `dns.resolve4` 转发上游、结果带 TTL 缓存"的模式（生产 DNS 是二进制协议，这里出于演示目的用 JSON 文本）。

## 运行

```bash
# 终端1
npx ts-node server.ts 15353
# 终端2
npx ts-node client.ts example.com 127.0.0.1 15353
# 再次查询同一域名可看到 'cache 命中'
npx ts-node client.ts example.com 127.0.0.1 15353
```

## 要点

- 使用 `dgram.createSocket('udp4')` 监听。
- 缓存用简化 LRU（接入 demo 115 的思路），TTL 60 秒。
- 两次查询同一域名可看到 `cache 命中` 字样，无需再访问上游解析器。