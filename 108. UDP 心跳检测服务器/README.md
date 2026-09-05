# 108. UDP 心跳检测服务器

UDP 上的心跳协议示例：客户端定期 `PING`，服务端回 `PONG` 并维护在线客户端列表，超时未心跳的客户端被剔除。

## 运行

```bash
# 终端1
npx ts-node server.ts 41234
# 终端2
npx ts-node client.ts 41234 3
# 终端3
npx ts-node client.ts 41234 4
```

## 要点

- `dgram.createSocket('udp4')` 用于无连接通信。
- 服务端用 `Map<key, {lastBeat}>` 跟踪心跳时间，定时扫描清除超时客户端。
- `WHO` 指令可查询当前在线列表。