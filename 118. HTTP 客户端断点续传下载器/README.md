# 118. HTTP 客户端断点续传下载器

按 `Range: bytes=start-end` 分块下载文件，每块以 `r+` 模式按偏移写入已 `ftruncate` 好的目标文件；每块完成即把进度写入 `out.progress.json`，进程异常退出后**再次运行同一命令即可继续**，跳过已下载的分片。

## 运行

```bash
npx ts-node downloader.ts https://example.com/big.bin out.bin 1
# 中断后再次执行同命令可直接续传
```

## 要点

- `HEAD` 请求拿 `Content-Length` 决定分块数量。
- 每块进度 JSON 持久化，重启解析后跳过已下载段。
- 下载完校验最终文件大小 == Content-Length，删除进度文件。