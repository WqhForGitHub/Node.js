# 73. 分布式任务队列

纯 Node.js 实现的分布式任务队列，支持多 Worker 并发消费、优先级、延迟任务、失败重试和持久化。

## 架构

```
Producer ──┐
           ├──> [Queue Server (TCP)] <── Worker(s)
Producer ──┘         持久化 JSON
```

## 文件

- `queue.js` - 队列核心：优先级队列、重试、持久化
- `server.js` - TCP 服务器，暴露队列 API
- `worker.js` - 工作进程，拉取并执行任务
- `producer.js` - 生产者示例

## 使用

```bash
# 终端 1: 启动队列服务器
node server.js

# 终端 2、3: 启动多个 Worker
node worker.js
node worker.js

# 终端 4: 提交任务
node producer.js
```

## 协议

TCP 上传输换行分隔的 JSON：
- `add`：添加任务（支持 priority, delay, maxRetries）
- `reserve`：取出一个待处理任务
- `complete`：标记完成
- `fail`：标记失败（自动重试）
- `stats`：查看统计
