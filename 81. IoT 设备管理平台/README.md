# 81. IoT 设备管理平台

纯 Node.js 实现的 IoT 设备管理平台，包含设备注册、状态管理、远程命令下发、遥测采集。

## 架构

```
设备(TCP) ──> [TCP 接入服务器:7101] ──> Registry (JSON 持久化)
                                              ↑
管理端 ──> [HTTP API:7100] ──── 命令下发 ──────┘
```

## 文件

- `registry.js` - 设备注册中心（持久化、分组、状态管理）
- `server.js` - HTTP 管理 API + TCP 设备接入
- `device.js` - 模拟 IoT 设备客户端

## 启动

```bash
# 启动平台
node server.js

# 启动设备
node device.js dev-001 temperature-sensor
node device.js dev-002 humidity-sensor
```

## API

- `GET /devices` - 列出所有设备（支持 ?group=xxx&status=online）
- `GET /devices/:id` - 获取设备详情
- `GET /devices/:id/telemetry` - 获取遥测历史（最近100条）
- `POST /devices/:id/command` - 下发命令
- `DELETE /devices/:id` - 删除设备

## 设备协议

换行分隔 JSON：
- `register` - 注册
- `heartbeat` - 心跳
- `telemetry` - 上报遥测数据
- `command` - 平台下发命令
