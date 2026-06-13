# 75. 实时协作编辑服务

类 Google Docs 的实时协作文本编辑，纯 Node.js 实现，使用 **OT（操作转换）** 算法保证一致性。

## 特性

- 纯手写 WebSocket 协议（无依赖）
- OT 算法：插入/删除操作的转换
- 多用户在线（不同颜色标识）
- 文档版本号 + 历史回放
- 房间隔离（URL 中 #docId）

## 文件

- `ws.js` - WebSocket 协议实现
- `ot.js` - OT 操作转换算法
- `server.js` - 协作服务器
- `client.html` - 浏览器编辑器

## 运行

```bash
node server.js
```

访问 `http://127.0.0.1:7500/#myDoc` ，在多个窗口打开同一 URL 即可看到协同效果。

## OT 转换规则

| op1\op2 | insert | delete |
|---------|--------|--------|
| insert  | 偏移 pos | 减去 len |
| delete  | 加 text.length | 重叠裁剪 |
