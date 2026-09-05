# 111. 进程守护与自动重启机制

类似 pm2 的极简守护进程：通过子进程托管业务逻辑，子进程异常退出后冷却 `COOL_DOWN_MS` 自动重启，限制最大重启次数避免无限循环。

## 运行

```bash
npx ts-node daemon.ts
```

## 要点

- 用 `child_process.fork()` 启动子进程，通过环境变量 `CHILD=1` 让子进程进入业务分支。
- 监听子进程 `exit`，非 0 退出 + 未达最大重启次数 → 重新 `fork`。
- 实际可把本脚本改为守护其他脚本：`fork(otherScriptPath, [...])`。