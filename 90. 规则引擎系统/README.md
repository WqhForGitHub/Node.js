# 90. 规则引擎系统

纯 Node.js 实现,支持 JSON DSL 定义业务规则。

## 特性
- 复合条件: `all` / `any` / `not`
- 运算符: `==` `!=` `>` `>=` `<` `<=` `in` `nin` `contains` `startsWith` `endsWith` `regex` `between` `exists`
- 嵌套字段访问: `user.profile.age`
- 优先级排序、启用/禁用、stop 中止
- 动作类型: `set` / `add` / `log` / `emit` / `stop`

## 启动
```bash
node server.js   # http://localhost:3090
```

## 规则示例
```json
{
  "name": "VIP打折",
  "priority": 100,
  "when": { "all": [
    { "fact": "user.level", "op": "==", "value": "vip" },
    { "fact": "order.amount", "op": ">=", "value": 1000 }
  ]},
  "then": [
    { "type": "set", "key": "order.discount", "value": 0.2 },
    { "type": "log", "message": "VIP折扣20%" }
  ]
}
```

## 运行
```bash
curl -X POST http://localhost:3090/run \
  -H "Content-Type: application/json" \
  -d '{"user":{"level":"vip","riskScore":10},"order":{"amount":2000}}'
```
