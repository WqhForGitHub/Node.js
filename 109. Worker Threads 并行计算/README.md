# 109. Worker Threads 并行计算

使用 Node.js `worker_threads` 把一个大区间的质数统计任务切分到多个 Worker 并行计算，主线程汇总结果。

## 运行

```bash
npx ts-node main.ts 4 1 1000000
```

## 要点

- 同一份脚本通过 `isMainThread` 分支区分主线程 / 子线程角色。
- 主线程用 `new Worker(__filename, { workerData })` 派生，并通过 `message` 事件收集结果。
- Worker 内同步计算质数（不阻塞主线程），完成后 `parentPort.postMessage` 上报。