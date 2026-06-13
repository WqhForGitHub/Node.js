# 企业级审计日志系统

纯 Node.js 实现的企业级审计日志系统，无第三方依赖。

## 核心特性

### 数据完整性保护
- **HMAC-SHA256 签名**: 服务端密钥签名每条事件
- **哈希链 (Hash Chain)**: 类区块链结构，前一条事件的 hash 作为下一条的 prevHash
- **不可篡改验证**: 任何对历史的篡改都会断开哈希链
- **完整性校验 API**: 一键验证所有历史事件

### 存储架构
- **Append-only 日志**: 仅追加写入，不修改不删除
- **按日期分片**: 每日一个 JSONL 文件，便于归档
- **倒排索引**: actor/action/resource/result/severity 五维索引
- **时间序列优化**: 按时间倒序快速查询

### 审计字段标准化
```
{
  id: 唯一ID
  timestamp: ISO时间
  actor: 操作者（用户/服务）
  action: 动作（login/read/update/delete/export等）
  resource: 资源标识
  result: success/failure/denied
  severity: info/warning/error/critical
  context: 上下文元数据
  sourceIp: 来源IP
  userAgent: 客户端
  prevHash: 前一事件哈希
  signature: HMAC签名
  hash: 本事件哈希
}
```

### 实时告警
- 规则引擎，支持阈值触发
- 默认规则：高危操作检测、登录暴破检测
- 可扩展自定义规则

### 合规导出
- JSON / CSV 格式（带 UTF-8 BOM 兼容 Excel）
- 多维度筛选导出

### Web 控制台
- 实时统计面板
- 完整性校验
- 多维度查询
- 告警监控
- 模拟事件写入

## 文件

- [server.js](./server.js) - 审计日志服务端
- [client.js](./client.js) - 业务侧 SDK 与演示

## 启动

```bash
# 终端 1: 启动审计服务
node server.js
# 访问 http://localhost:3100

# 终端 2: 模拟业务上报
node client.js
```

## 业务集成示例

```javascript
const AuditClient = require('./client');
const audit = new AuditClient('http://audit.internal:3100');

// 在你的业务代码中
app.post('/api/login', async (req, res) => {
  try {
    const user = await auth.login(req.body);
    audit.log({
      actor: user.id,
      action: 'login',
      resource: '/auth/login',
      result: 'success',
      severity: 'info',
      sourceIp: req.ip,
    });
    res.json({ token: user.token });
  } catch (e) {
    audit.log({
      actor: req.body.username,
      action: 'login',
      resource: '/auth/login',
      result: 'failure',
      severity: 'warning',
      context: { reason: e.message },
    });
    res.status(401).json({ error: e.message });
  }
});
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/audit | 写入单条 |
| POST | /api/audit/batch | 批量写入 |
| GET  | /api/audit/search | 查询（actor/action/resource/result/severity/q/startTime/endTime） |
| GET  | /api/audit/verify | 完整性校验 |
| GET  | /api/audit/stats | 统计摘要 |
| GET  | /api/audit/export | CSV 导出 |
| GET  | /api/alerts | 告警列表 |

## 完整性校验原理

```
GENESIS_HASH ─┐
              ▼
         Event 1: prevHash=GENESIS, sig=HMAC(...), hash=SHA256(content+sig)
              ▼ (hash → prevHash)
         Event 2: prevHash=Event1.hash, sig=HMAC(...), hash=...
              ▼
         Event 3: ...
```

任何历史事件被篡改：
1. 该事件的签名会失效（HMAC 不匹配）
2. 该事件的 hash 改变
3. 后续所有事件的 prevHash 均与实际不符
4. 校验 API 立刻发现并标记错误位置

## 安全建议（生产环境）

1. **HMAC Secret**: 使用环境变量 `AUDIT_HMAC_SECRET` 配置高熵密钥
2. **存储隔离**: 审计存储应放在独立卷，业务进程仅有写权限不能删除
3. **WORM 存储**: 接入对象存储的 WORM（Write Once Read Many）模式
4. **网络隔离**: 审计服务部署在独立网段
5. **远程归档**: 定期同步到不可变冷存储
6. **监控告警**: 集成 SIEM、邮件、短信通道

## 合规支持

可对接 SOX / GDPR / HIPAA / 等保 / ISO27001 等合规要求所需的关键审计字段：
who（actor）、what（action+resource）、when（timestamp）、where（sourceIp）、result、不可篡改证据（hash chain）。
