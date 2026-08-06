# 105. HTTP 静态服务器（支持缓存与 Range 断点续传）

功能：MIME 推断、`Cache-Control`/`ETag`/`Last-Modified` 协商缓存、`Accept-Ranges: bytes` + `Range` 请求（206）。

## 运行

```bash
npx ts-node server.ts ./ 3000
# 测试 Range：
curl -r 0-99 http://localhost:3000/server.ts -o head.txt
# 测试协商缓存：
curl -I -H 'If-None-Match: "<etag>"' http://localhost:3000/xxx
```

## 要点

- `ETag` 使用 `size-mtimeMs` 十六进制拼接，无需读取内容。
- `Range` 支持 `bytes=start-end`，缺省则改为后缀 `bytes=-N`。
- 目录返回简易 HTML 索引；越界范围返回 416。