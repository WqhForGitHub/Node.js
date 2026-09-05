# 119. 简易内存数据库（KV + WAL 预写日志）

KV 内存数据库，所有写操作先 append 到 `wal.log`（Write-Ahead Log）再修改内存；启动时先读 `snapshot.json` 再回放 WAL，实现崩溃可恢复。`checkpoint()` 把当前内存状态作为新快照，并清空 WAL。

## 运行

```bash
npx ts-node db.ts ./kvdata
# 多次运行可看到上次状态被恢复
```

## 要点

- **WAL** 模式：写操作必须**先落盘后**再改内存，崩溃时通过回放 WAL 重建状态。
- `del` 同样记一条 `put value=null` 的日志以表达删操作。
- `checkpoint` 把当前 Map 序列化为 JSON 快照，避免 WAL 无限增长。