# 103. 实时日志监听（tail -f 实现）

类 Unix `tail -f` 的 Node.js 实现：首次打开时定位到文件末尾，之后只输出新增内容，并处理文件截断/轮转。

## 运行

```bash
# 终端1
echo hello >> app.log
# 终端2
npx ts-node tail.ts app.log
# 终端1 继续追加
echo world >> app.log
```

## 要点

- 初始 `pos = size` 只监听后续新增；可改成 `0` 实现 `tail -f` 同时查看历史。
- `fs.watch` 事件触发随机读取 `[pos, size)` 区间，文件变小时视为轮转重置。
- 1 秒兜底轮询防止某些系统 watch 失效。