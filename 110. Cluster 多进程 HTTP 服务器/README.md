# 110. Cluster 多进程 HTTP 服务器

利用 Node.js `cluster` 模块，按 CPU 核心数启动多个工作进程共享一个端口，主进程负责 fork 和重启。

## 运行

```bash
npx ts-node server.ts 3000
curl http://localhost:3000/  # 多次请求会返回不同 pid
```

## 要点

- `cluster.isPrimary` 区分主工作进程逻辑。
- 工作进程崩溃时主进程监听 `exit` 事件，自动 `cluster.fork()` 重启。
- 同一个端口被多个工作进程共享，操作系统做负载均衡（轮询）。