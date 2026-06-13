# 94. Serverless 函数平台

纯 Node.js 实现的迷你 FaaS 平台。每次调用使用 `worker_threads` + `vm` 隔离执行,有 5 秒超时保护。

## 特性
- 函数代码热更新(自动版本号递增)
- VM Sandbox + Worker Thread 隔离
- 5 秒超时保护
- HTTP 触发器
- 调用统计/平均耗时
- 文件持久化(meta.json)

## 启动
```bash
node server.js   # http://localhost:3094
```

## 用户函数格式
```js
// 方式1: 命名导出 handler
module.exports.handler = async (event, ctx) => {
  return { hello: event.name };
};

// 方式2: 直接导出函数
module.exports = (event) => ({ ok: true });
```

## 接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /functions | 列表+指标 |
| POST | /functions | 创建/更新 `{name, code}` |
| GET | /functions/:name | 详情 |
| DELETE | /functions/:name | 删除 |
| POST | /invoke/:name | 调用 |
| ANY | /trigger/:name | HTTP 触发(将 method/query/body/headers 注入 event) |
| GET | /metrics | 全局指标 |

## 调用
```bash
# 调用 hello 函数
curl -X POST http://localhost:3094/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Node.js"}'

# 创建新函数
curl -X POST http://localhost:3094/functions \
  -H "Content-Type: application/json" \
  -d '{
    "name":"square",
    "code":"module.exports = e => ({ result: e.n * e.n });"
  }'

# HTTP 触发
curl http://localhost:3094/trigger/hello?name=Foo
```
