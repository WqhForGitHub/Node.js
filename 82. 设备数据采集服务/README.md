# 82. 设备数据采集服务

纯 Node.js 实现的设备数据采集服务，支持 HTTP/UDP/TCP 多协议接入，批量缓冲并按日期分片持久化。

## 架构

```
设备 ──HTTP/UDP/TCP──> [Collector(buffer)] ─批量─> data/YYYY-MM-DD.ndjson
                              ↑
                          [查询 API]
```

## 文件

- `collector.js` - 采集器核心：批量缓冲、按日分片、查询
- `server.js` - HTTP/UDP/TCP 三协议接入
- `simulator.js` - 模拟设备数据生成器

## 启动

```bash
node server.js       # 启动采集服务
node simulator.js    # 模拟设备发送数据
```

## API

- `POST /ingest` - 上报数据点（单条或数组）
- `GET /query?device=&metric=&from=&to=&limit=` - 查询历史
- `GET /stats` - 采集统计

## 数据点格式

```json
{ "device": "dev-001", "metric": "temperature", "value": 23.5, "ts": 1700000000000 }
```
