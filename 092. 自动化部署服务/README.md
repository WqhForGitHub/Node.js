# 92. 自动化部署服务

纯 Node.js 实现的多项目多环境部署平台。

## 特性
- 项目+环境配置(dev/staging/prod)
- 多步骤 Shell 命令编排
- 部署历史 / 状态 / 日志
- 一键回滚到历史成功版本
- Webhook 触发
- 文件持久化(data/db.json)

## 启动
```bash
node server.js   # http://localhost:3092
```

## 接口
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /projects | 项目列表 |
| POST | /projects | 注册项目 |
| POST | /deploy/:project/:env | 触发部署 |
| POST | /rollback/:project/:env | 回滚 |
| GET | /deployments | 最近 50 次部署 |
| GET | /deployments/:id | 部署详情/日志 |
| POST | /webhook/:project | Webhook 触发部署 |

## 注册项目
```bash
curl -X POST http://localhost:3092/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name":"my-app",
    "repo":"https://github.com/x/y",
    "environments":{
      "dev":{"steps":["echo pulling","echo installing","echo starting"]}
    }
  }'
```

## 部署
```bash
curl -X POST http://localhost:3092/deploy/demo-app/dev
```
