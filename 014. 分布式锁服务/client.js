/**
 * 分布式锁客户端示例
 * 演示：互斥锁、可重入、锁竞争、锁续期、读写锁
 */
const http = require('http');

class LockClient {
  constructor(baseUrl = 'http://localhost:3097', clientId) {
    this.baseUrl = baseUrl;
    this.clientId = clientId || `client-${Math.random().toString(36).slice(2, 8)}`;
  }

  request(path, body = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ clientId: this.clientId, ...body });
      const u = new URL(this.baseUrl + path);
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
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(chunks) }));
        }
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  acquire(key, ttl = 30000) {
    return this.request('/lock/acquire', { key, ttl });
  }

  acquireBlocking(key, ttl = 30000, timeout = 10000) {
    return this.request('/lock/acquire', { key, ttl, blocking: true, timeout });
  }

  release(key, token) {
    return this.request('/lock/release', { key, token });
  }

  renew(key, token, ttl = 30000) {
    return this.request('/lock/renew', { key, token, ttl });
  }

  // 高阶函数：自动获取锁、执行任务、释放锁
  async withLock(key, taskFn, options = {}) {
    const { ttl = 30000, timeout = 10000, autoRenew = false } = options;
    const result = await this.acquireBlocking(key, ttl, timeout);
    if (!result.body.success) {
      throw new Error(`获取锁失败: ${JSON.stringify(result.body)}`);
    }
    const token = result.body.token;
    console.log(`[${this.clientId}] ✓ 获取锁 ${key} token=${token}`);

    let renewTimer;
    if (autoRenew) {
      renewTimer = setInterval(async () => {
        const r = await this.renew(key, token, ttl);
        if (r.body.success) console.log(`[${this.clientId}] ↻ 锁续期成功`);
      }, ttl / 3);
    }

    try {
      return await taskFn(token);
    } finally {
      if (renewTimer) clearInterval(renewTimer);
      const rel = await this.release(key, token);
      console.log(`[${this.clientId}] ✗ 释放锁 ${key} ${rel.body.success ? 'OK' : 'FAIL'}`);
    }
  }
}

// ============ 演示 ============
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function demo() {
  console.log('===== 演示 1: 互斥锁基本使用 =====');
  const c1 = new LockClient(undefined, 'client-A');
  const r1 = await c1.acquire('resource:order:001', 5000);
  console.log('client-A 获取锁:', r1.body);

  const c2 = new LockClient(undefined, 'client-B');
  const r2 = await c2.acquire('resource:order:001', 5000);
  console.log('client-B 获取锁(应失败):', r2.body);

  await c1.release('resource:order:001', r1.body.token);
  console.log('client-A 释放锁后, client-B 重试:');
  const r3 = await c2.acquire('resource:order:001', 5000);
  console.log('client-B 获取锁:', r3.body);
  await c2.release('resource:order:001', r3.body.token);

  console.log('\n===== 演示 2: 可重入锁 =====');
  const cR = new LockClient(undefined, 'client-Reentrant');
  const e1 = await cR.acquire('resource:reentrant', 10000);
  console.log('第1次获取:', e1.body);
  const e2 = await cR.acquire('resource:reentrant', 10000);
  console.log('第2次获取(可重入):', e2.body);
  await cR.release('resource:reentrant', e1.body.token);
  await cR.release('resource:reentrant', e1.body.token);

  console.log('\n===== 演示 3: 锁竞争（公平队列） =====');
  const start = Date.now();
  const tasks = [1, 2, 3].map(async (i) => {
    const c = new LockClient(undefined, `worker-${i}`);
    return c.withLock(
      'resource:critical',
      async () => {
        console.log(`  [worker-${i}] 进入临界区 (+${Date.now() - start}ms)`);
        await sleep(800);
        console.log(`  [worker-${i}] 离开临界区`);
      },
      { ttl: 5000, timeout: 10000 }
    );
  });
  await Promise.all(tasks);

  console.log('\n===== 演示 4: 自动续期 =====');
  const cAR = new LockClient(undefined, 'client-LongTask');
  await cAR.withLock(
    'resource:long-task',
    async () => {
      console.log('  执行长时间任务（3秒）...');
      await sleep(3000);
      console.log('  长任务完成');
    },
    { ttl: 1500, timeout: 5000, autoRenew: true }
  );

  console.log('\n演示完成!');
}

if (require.main === module) {
  demo().catch(console.error);
}

module.exports = LockClient;
