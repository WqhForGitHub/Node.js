# 数据爬虫平台

纯 Node.js 实现的可视化数据爬虫平台，无第三方依赖。

## 功能特性

- **可视化控制台**: 浏览器创建/管理爬虫任务
- **多任务并行**: 任务管理器支持多任务同时运行
- **并发抓取**: 单任务内多 worker 并发
- **URL 去重**: 基于 Set 的 URL 指纹去重
- **优先级队列**: 按深度/优先级排序
- **域名白名单**: 防止爬虫扩散
- **限速控制**: 每域名独立 rate limit
- **自动重试**: 指数退避重试
- **重定向处理**: 自动跟随 301/302
- **Gzip 解压**: 自动处理压缩响应
- **UA 池随机**: 避免单一 UA
- **HTML 解析**: 内置 title/meta/links/CSS 选择器
- **JSONL 持久化**: 数据流式写入 data 目录

## 启动

```bash
node server.js
# 访问 http://localhost:3098
```

## 使用方式

1. 浏览器打开控制台
2. 填写起始 URL、深度、最大页数、并发数等
3. 点击"启动任务"
4. 实时查看任务状态和抓取数据
5. 数据保存在 `data/{taskId}.jsonl`

## 模块说明

| 模块 | 说明 |
|------|------|
| `Downloader` | HTTP/HTTPS 下载器，支持重试、UA 池、gzip |
| `SimpleParser` | HTML 解析器（title/meta/links/CSS 子集） |
| `URLQueue` | URL 优先级队列 + 指纹去重 |
| `RateLimiter` | 按域名隔离的速率限制器 |
| `SpiderTask` | 单任务调度，事件驱动 |
| `TaskManager` | 多任务管理 |

## 数据格式

每行一条 JSON：

```json
{"url":"https://...","depth":0,"title":"...","meta":{...},"contentLength":1234,"crawledAt":"2025-..."}
```

## 注意

请仅爬取公开、合规、有授权的网站，遵守 robots.txt 与目标网站的服务条款。
