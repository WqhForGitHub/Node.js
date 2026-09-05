# 84. 指标监控系统

纯 Node.js 实现的指标监控系统，支持 Counter/Gauge/Histogram 三种指标类型，规则告警，Prometheus 兼容输出。

## 文件

- `metrics.js` - 指标类型实现（Counter, Gauge, Histogram, Registry）
- `alert.js` - 告警规则引擎（支持持续时间、状态机）
- `server.js` - HTTP 接收 + 查询 + Web UI
- `client.js` - 模拟应用指标上报

## 启动

```bash
node server.js
node client.js
```

打开 http://127.0.0.1:7400 查看 UI。

## API

- `POST /metrics/inc?name=&value=` - Counter 累加
- `POST /metrics/gauge?name=&value=` - Gauge 设值
- `POST /metrics/observe?name=&value=` - Histogram 观察
- `GET /metrics` - Prometheus 文本格式
- `GET /snapshot` - JSON 快照
- `GET /alerts` - 当前告警 + 历史
- `POST /rules` - 新增告警规则

## 告警规则示例

```json
{ "name": "高错误率", "metric": "http_errors_total", "op": ">", "threshold": 100, "duration": 5000 }
```
