# 107. TCP 广播聊天室

基于 `net` 模块的 TCP 聊天室服务端，客户端连接后可设置昵称、群聊广播、查看在线、退出。

## 运行

```bash
# 终端1
npx ts-node server.ts 5000
# 终端2
npx ts-node client.ts 5000
# 终端3（或 telnet localhost 5000）
npx ts-node client.ts 5000
```

## 命令

- `/nick <name>` 设置昵称
- `/who` 列出在线
- `/quit` 退出

## 要点

- `Set<Client>` 保存在线连接，广播时跳过发送者。
- 按行切分（按 `\n` 分包）避免 TCP 粘包。