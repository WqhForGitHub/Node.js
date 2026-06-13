# 93. CI/CD 简化系统

纯 Node.js 实现的迷你 CI/CD 平台。

## 特性
- Pipeline 配置: stages -> jobs -> steps
- 串行 Stage / 并行 Job
- 构建队列 + 并发控制(默认 2)
- Artifacts 收集
- Webhook 触发
- 构建日志/历史持久化

## 启动
```bash
node server.js   # http://localhost:3093
```

## Pipeline 示例
```json
{
  "name": "myapp",
  "trigger": ["push","manual"],
  "stages": [
    { "name":"build", "jobs":[
      { "name":"compile","steps":["npm install","npm run build"],"artifacts":["dist/"] }
    ]},
    { "name":"test", "jobs":[
      { "name":"unit","steps":["npm test"] },
      { "name":"lint","steps":["npm run lint"] }
    ]},
    { "name":"deploy","jobs":[
      { "name":"release","steps":["echo deploying"] }
    ]}
  ]
}
```

## 接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /pipelines | 列出 |
| POST | /pipelines | 注册 |
| POST | /trigger/:pipeline | 手动触发 |
| POST | /webhook/:pipeline | Webhook 触发 |
| GET | /builds | 构建历史 |
| GET | /builds/:id | 构建详情 |
| GET | /builds/:id/logs | 纯文本日志 |

## 触发
```bash
curl -X POST http://localhost:3093/trigger/hello-ci
curl http://localhost:3093/builds
```
