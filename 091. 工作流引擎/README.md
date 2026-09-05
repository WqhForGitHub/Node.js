# 91. 工作流引擎

纯 Node.js 实现的轻量工作流编排引擎。

## 特性
- DAG 节点编排,通过 `next` 链接
- 节点类型: `task.*` / `condition` / `parallel` / `end`
- 条件分支: 表达式驱动的多路 case
- 并行执行: `parallel` + `branches`
- 任务重试: `retry: N`
- 异步执行 + 历史追踪

## 启动
```bash
node server.js   # http://localhost:3091
```

## 内置示例: 订单流程
1. validate -> check_stock -> condition
2. 条件分支决定 reject 或 parallel
3. parallel 并发执行 pay + notify_warehouse
4. 汇合后 finish -> end

## 接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /workflows | 列出已注册流程 |
| POST | /workflows | 注册新流程定义 |
| POST | /run/:wfId | 启动执行 |
| GET | /executions/:id | 查询执行详情 |

## 示例
```bash
curl -X POST http://localhost:3091/run/order_process \
  -H "Content-Type: application/json" \
  -d '{"input":{"amount":100}}'
```
