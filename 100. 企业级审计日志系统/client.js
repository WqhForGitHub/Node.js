/**
 * 审计日志客户端 SDK
 * 业务系统通过此 SDK 上报审计事件
 */
const http = require('http');

class AuditClient {
  constructor(baseUrl = 'http://localhost:3100') {
    this.baseUrl = baseUrl;
    this.queue = [];
    this.flushInterval = 2000;
    this.maxBatch = 50;
    this.startFlusher();
  }

  /**
   * 上报审计事件（异步入队，批量发送）
   */
  log(event) {
    this.queue.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    if (this.queue.length >= this.maxBatch) this.flush();
  }

  // 立即同步上报
  logSync(event) {
    return this.send('/api/audit', { ...event, timestamp: new Date().toISOString() });
  }

  startFlusher() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.maxBatch);
    try {
      await this.send('/api/audit/batch', { events: batch });
    } catch (e) {
      // 失败重新入队
      this.queue.unshift(...batch);
      console.error('[AuditClient] 上报失败:', e.message);
    }
  }

  send(path, body) {
    return new Promise((resolve, reject) => {
      const u = new URL(path, this.baseUrl);
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (c) => (chunks += c));
          res.on('end', () => resolve(JSON.parse(chunks)));
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

// ============ 演示 ============
async function demo() {
  const audit = new AuditClient();

  console.log('===== 模拟业务系统上报审计事件 =====\n');

  // 1. 普通用户登录
  audit.log({
    actor: 'user-1001',
    action: 'login',
    resource: '/auth/login',
    result: 'success',
    severity: 'info',
    context: { method: 'password', mfa: true },
    sourceIp: '192.168.1.100',
  });

  // 2. 数据查看
  audit.log({
    actor: 'user-1001',
    action: 'read',
    resource: '/api/customers/8001',
    result: 'success',
    severity: 'info',
    context: { fields: ['name', 'phone'] },
  });

  // 3. 敏感操作 - 修改用户权限
  audit.log({
    actor: 'admin-001',
    action: 'update_role',
    resource: '/api/users/2099',
    result: 'success',
    severity: 'warning',
    context: { from: 'user', to: 'admin', reason: '晋升' },
  });

  // 4. 删除关键数据 - 高危
  audit.log({
    actor: 'admin-001',
    action: 'delete',
    resource: '/api/orders/all',
    result: 'success',
    severity: 'critical',
    context: { count: 5000, reason: '清理过期订单' },
  });

  // 5. 模拟暴力破解 - 5次登录失败
  console.log('模拟暴力破解攻击（5次登录失败）...');
  for (let i = 0; i < 5; i++) {
    audit.log({
      actor: 'attacker',
      action: 'login',
      resource: '/auth/login',
      result: 'failure',
      severity: 'warning',
      context: { reason: 'wrong_password', attempt: i + 1 },
      sourceIp: '203.0.113.42',
    });
  }

  // 6. 数据导出 - 合规关注
  audit.log({
    actor: 'analyst-007',
    action: 'export',
    resource: '/api/reports/financial-q4',
    result: 'success',
    severity: 'warning',
    context: { format: 'csv', recordCount: 12000 },
  });

  // 7. 拒绝访问
  audit.log({
    actor: 'user-2099',
    action: 'access',
    resource: '/api/admin/settings',
    result: 'denied',
    severity: 'warning',
    context: { reason: 'insufficient_privilege' },
  });

  // 等待批量上报
  await new Promise((r) => setTimeout(r, 3000));
  await audit.flush();

  console.log('已上报模拟审计事件');
  console.log('请打开 http://localhost:3100 查看 Web 控制台');
}

if (require.main === module) {
  demo().catch(console.error);
}

module.exports = AuditClient;
