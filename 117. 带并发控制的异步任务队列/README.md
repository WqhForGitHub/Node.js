# 117. 带并发控制的异步任务队列

通用异步任务队列（生产/消费模型），最多并发 `N` 个任务，超额任务排队等待，提供 `drain()` 等待全部完成。

## 运行

```bash
npx ts-node queue.ts
```

## 要点

- `add()` 立即返回 Promise，任务在尾队列等待 tick 调度。
- `active < concurrency && pending.length` 时主动启动新任务。
- 用 `drainResolvers` 数组保存所有等待 drain 的 Promise。