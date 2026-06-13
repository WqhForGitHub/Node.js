# 79. 实时位置共享服务

类"高德足迹/微信共享实时位置"的服务，纯 Node.js 实现。

## 功能

- WebSocket 实时位置上报与广播
- **GeoHash 空间索引**：高效附近搜索
- **Haversine 距离公式**：精确球面距离
- 群组隔离（出行小队）
- 浏览器 H5 定位（geolocation API）
- 客户端简易地图渲染（无第三方地图依赖）
- 离线/超时清理
- 距离实时计算

## 文件

- `ws.js` - WebSocket 协议
- `geo.js` - GeoHash 索引 + 距离计算
- `server.js` - 服务端
- `client.html` - 移动浏览器客户端

## 运行

```bash
node server.js
```

访问 `http://127.0.0.1:7900/`，输入昵称、群组后浏览器会请求定位权限。

## 协议

```
client -> server:
  { type: 'join', name, group }
  { type: 'location', lat, lon, accuracy, speed }
  { type: 'nearby', lat, lon, radius }
  { type: 'group-snapshot' }

server -> client:
  { type: 'joined', userId }
  { type: 'location-update', userId, name, lat, lon, ts }
  { type: 'nearby-result', users: [...] }
  { type: 'group-snapshot', members: [...] }
  { type: 'user-leave', userId }
```

## REST API

- `GET /api/nearby?lat=39.9&lon=116.4&r=1000` - 查附近 r 米内用户
