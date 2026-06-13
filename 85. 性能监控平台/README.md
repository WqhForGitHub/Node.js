# 85. 性能监控平台 (APM)

纯 Node.js 实现的应用性能监控平台，支持调用链追踪、span 树展示、服务级 P95/P99 统计。

## 文件

- `tracer.js` - 客户端 Tracer SDK（Span / 自动追踪）
- `server.js` - 收集器：组装调用链树、聚合服务指标、Web UI
- `app.js` - 演示应用：带追踪的模拟业务请求

## 启动

```bash
node server.js   # APM 服务端
node app.js      # 演示应用
```

打开 http://127.0.0.1:7500 查看调用链。

## API

- `POST /spans` - 上报 span（单条或数组）
- `GET /traces` - 最近的调用链列表
- `GET /traces/:traceId` - 调用链详情（树形）
- `GET /services` - 服务级聚合指标（错误率、P95、P99）

## 数据模型

每个 Span 包含：traceId / spanId / parentId / name / startTime / duration / tags / logs / status。
通过 parentId 在 server 端组装出调用链树。
