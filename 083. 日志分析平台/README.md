# 83. 日志分析平台

纯 Node.js 实现的日志收集、解析、聚合和查询平台。

## 架构

```
应用日志 ──TCP/HTTP──> [Parser] ──> [Store + Index]
                                       ↓
                         Web UI / API (搜索/统计/趋势)
```

## 文件

- `parser.js` - 日志解析器（JSON / 通用 / Apache access）
- `store.js` - 内存索引 + 按日期分片持久化 + 实时聚合
- `server.js` - HTTP API + Web UI + TCP 接入
- `shipper.js` - 日志推送客户端（tail -f 或模拟）

## 启动

```bash
node server.js
node shipper.js                  # 模拟日志
node shipper.js /var/log/app.log # 监控文件
```

打开 http://127.0.0.1:7300 查看 Web UI。

## API

- `POST /ingest?source=app` - 接收日志（多行或单行）
- `GET /search?q=&level=&source=&limit=` - 搜索日志
- `GET /stats` - 实时统计（级别、Top 来源、分钟趋势）
