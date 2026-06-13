/**
 * 分布式锁服务 - 纯 Node.js 实现
 *
 * 功能特性：
 * 1. 基于 HTTP 的分布式锁服务
 * 2. 支持互斥锁（Mutex）和读写锁（RWLock）
 * 3. 支持锁超时自动释放（防死锁）
 * 4. 支持锁续期（Lease Renewal）
 * 5. 支持公平队列（FIFO）等待
 * 6. 支持锁的可重入（Reentrant）
 * 7. 唯一令牌机制（fencing token）防止误释放
 */

const http = require('http');
const crypto = require('crypto');
const url = require('url');

// ============ 锁管理器 ============
class LockManager {
  constructor() {
    // 互斥锁映射：key -> { owner, token, expireAt, reentrantCount, waitQueue }
    this.mutexLocks = new Map();
    // 读写锁映射：key -> { writers, readers, waitQueue }
    this.rwLocks = new Map();
    // 全局递增的 fencing token
    this.tokenCounter = 0;
    // 启动定时清理过期锁
    this.startCleanup();
  }

  generateToken() {
    return ++this.tokenCounter;
  }

  generateLockId() {
    return crypto.randomBytes(8).toString('hex');
  }

  // 获取互斥锁
  acquireMutex(key, clientId, ttl = 30000) {
    const now = Date.now();
    let lock = this.mutexLocks.get(key);

    // 锁不存在或已过期，直接获取
    if (!lock || lock.expireAt <= now) {
      const token = this.generateToken();
      lock = {
        owner: clientId,
        token,
        expireAt: now + ttl,
        reentrantCount: 1,
        waitQueue: [],
      };
      this.mutexLocks.set(key, lock);
      return { success: true, token, owner: clientId, ttl };
    }

    // 同一客户端的可重入获取
    if (lock.owner === clientId) {
      lock.reentrantCount++;
      lock.expireAt = now + ttl;
      return { success: true, token: lock.token, owner: clientId, ttl, reentrant: lock.reentrantCount };
    }

    // 已被其他客户端持有
    return {
      success: false,
      reason: 'LOCKED',
      currentOwner: lock.owner,
      ttlRemaining: lock.expireAt - now,
    };
  }

  // 阻塞式获取互斥锁（带超时）
  acquireMutexBlocking(key, clientId, ttl, timeout) {
    return new Promise((resolve) => {
      const result = this.acquireMutex(key, clientId, ttl);
      if (result.success) {
        return resolve(result);
      }

      const lock = this.mutexLocks.get(key);
      const waitItem = {
        clientId,
        ttl,
        resolve,
        addedAt: Date.now(),
      };

      // 加入等待队列（FIFO 公平锁）
      lock.waitQueue.push(waitItem);

      // 超时处理
      const timer = setTimeout(() => {
        const idx = lock.waitQueue.indexOf(waitItem);
        if (idx >= 0) {
          lock.waitQueue.splice(idx, 1);
          resolve({ success: false, reason: 'TIMEOUT' });
        }
      }, timeout);

      waitItem.timer = timer;
    });
  }

  // 释放互斥锁
  releaseMutex(key, clientId, token) {
    const lock = this.mutexLocks.get(key);
    if (!lock) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    // fencing token 校验，防止过期客户端误释放
    if (lock.token !== token) {
      return { success: false, reason: 'INVALID_TOKEN' };
    }

    if (lock.owner !== clientId) {
      return { success: false, reason: 'NOT_OWNER' };
    }

    // 可重入计数递减
    lock.reentrantCount--;
    if (lock.reentrantCount > 0) {
      return { success: true, reentrant: lock.reentrantCount, fullyReleased: false };
    }

    // 完全释放，唤醒下一个等待者
    this.mutexLocks.delete(key);
    this.notifyNextWaiter(key, lock);

    return { success: true, fullyReleased: true };
  }

  // 唤醒下一个等待者
  notifyNextWaiter(key, oldLock) {
    while (oldLock.waitQueue.length > 0) {
      const waiter = oldLock.waitQueue.shift();
      clearTimeout(waiter.timer);
      const result = this.acquireMutex(key, waiter.clientId, waiter.ttl);
      if (result.success) {
        // 把剩余等待者迁移到新锁
        const newLock = this.mutexLocks.get(key);
        newLock.waitQueue = oldLock.waitQueue;
        waiter.resolve(result);
        return;
      }
    }
  }

  // 锁续期
  renewMutex(key, clientId, token, ttl = 30000) {
    const lock = this.mutexLocks.get(key);
    if (!lock) return { success: false, reason: 'NOT_FOUND' };
    if (lock.token !== token) return { success: false, reason: 'INVALID_TOKEN' };
    if (lock.owner !== clientId) return { success: false, reason: 'NOT_OWNER' };

    lock.expireAt = Date.now() + ttl;
    return { success: true, expireAt: lock.expireAt };
  }

  // 获取读锁
  acquireReadLock(key, clientId, ttl = 30000) {
    const now = Date.now();
    let lock = this.rwLocks.get(key);

    if (!lock) {
      lock = { writers: new Map(), readers: new Map(), waitQueue: [] };
      this.rwLocks.set(key, lock);
    }

    // 清理过期的写者
    for (const [id, info] of lock.writers) {
      if (info.expireAt <= now) lock.writers.delete(id);
    }

    // 有写锁持有者，读锁需要等待
    if (lock.writers.size > 0) {
      return { success: false, reason: 'WRITE_LOCKED', writers: Array.from(lock.writers.keys()) };
    }

    const token = this.generateToken();
    lock.readers.set(clientId, { token, expireAt: now + ttl });
    return { success: true, token, ttl };
  }

  // 获取写锁
  acquireWriteLock(key, clientId, ttl = 30000) {
    const now = Date.now();
    let lock = this.rwLocks.get(key);

    if (!lock) {
      lock = { writers: new Map(), readers: new Map(), waitQueue: [] };
      this.rwLocks.set(key, lock);
    }

    // 清理过期者
    for (const [id, info] of lock.readers) {
      if (info.expireAt <= now) lock.readers.delete(id);
    }
    for (const [id, info] of lock.writers) {
      if (info.expireAt <= now) lock.writers.delete(id);
    }

    // 已被其他写者持有
    if (lock.writers.size > 0 && !lock.writers.has(clientId)) {
      return { success: false, reason: 'WRITE_LOCKED' };
    }
    // 有读者
    if (lock.readers.size > 0) {
      return { success: false, reason: 'READ_LOCKED', readers: Array.from(lock.readers.keys()) };
    }

    const token = this.generateToken();
    lock.writers.set(clientId, { token, expireAt: now + ttl });
    return { success: true, token, ttl };
  }

  // 释放读/写锁
  releaseRWLock(key, clientId, token, type) {
    const lock = this.rwLocks.get(key);
    if (!lock) return { success: false, reason: 'NOT_FOUND' };

    const map = type === 'read' ? lock.readers : lock.writers;
    const info = map.get(clientId);

    if (!info) return { success: false, reason: 'NOT_OWNER' };
    if (info.token !== token) return { success: false, reason: 'INVALID_TOKEN' };

    map.delete(clientId);

    // 锁完全释放，清理
    if (lock.readers.size === 0 && lock.writers.size === 0) {
      this.rwLocks.delete(key);
    }

    return { success: true };
  }

  // 定时清理过期锁
  startCleanup() {
    setInterval(() => {
      const now = Date.now();

      // 清理互斥锁
      for (const [key, lock] of this.mutexLocks) {
        if (lock.expireAt <= now) {
          console.log(`[Cleanup] 互斥锁过期: ${key} (owner=${lock.owner})`);
          this.mutexLocks.delete(key);
          this.notifyNextWaiter(key, lock);
        }
      }

      // 清理读写锁
      for (const [key, lock] of this.rwLocks) {
        for (const [id, info] of lock.readers) {
          if (info.expireAt <= now) {
            lock.readers.delete(id);
            console.log(`[Cleanup] 读锁过期: ${key} (owner=${id})`);
          }
        }
        for (const [id, info] of lock.writers) {
          if (info.expireAt <= now) {
            lock.writers.delete(id);
            console.log(`[Cleanup] 写锁过期: ${key} (owner=${id})`);
          }
        }
        if (lock.readers.size === 0 && lock.writers.size === 0 && lock.waitQueue.length === 0) {
          this.rwLocks.delete(key);
        }
      }
    }, 1000);
  }

  // 获取所有锁的状态（监控用）
  getStatus() {
    const mutex = [];
    const now = Date.now();
    for (const [key, lock] of this.mutexLocks) {
      mutex.push({
        key,
        owner: lock.owner,
        token: lock.token,
        ttlRemaining: lock.expireAt - now,
        reentrantCount: lock.reentrantCount,
        waiters: lock.waitQueue.length,
      });
    }

    const rw = [];
    for (const [key, lock] of this.rwLocks) {
      rw.push({
        key,
        readers: Array.from(lock.readers.keys()),
        writers: Array.from(lock.writers.keys()),
      });
    }

    return { mutex, rw, totalTokens: this.tokenCounter };
  }
}

// ============ HTTP 服务 ============
const lockManager = new LockManager();

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    // 获取互斥锁: POST /lock/acquire { key, clientId, ttl, blocking, timeout }
    if (pathname === '/lock/acquire' && method === 'POST') {
      const body = await readBody(req);
      const { key, clientId, ttl = 30000, blocking = false, timeout = 5000 } = body;
      if (!key || !clientId) return sendJSON(res, 400, { error: 'key 和 clientId 必填' });

      const result = blocking
        ? await lockManager.acquireMutexBlocking(key, clientId, ttl, timeout)
        : lockManager.acquireMutex(key, clientId, ttl);
      return sendJSON(res, result.success ? 200 : 423, result);
    }

    // 释放互斥锁: POST /lock/release { key, clientId, token }
    if (pathname === '/lock/release' && method === 'POST') {
      const body = await readBody(req);
      const { key, clientId, token } = body;
      const result = lockManager.releaseMutex(key, clientId, token);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // 续期: POST /lock/renew { key, clientId, token, ttl }
    if (pathname === '/lock/renew' && method === 'POST') {
      const body = await readBody(req);
      const { key, clientId, token, ttl } = body;
      const result = lockManager.renewMutex(key, clientId, token, ttl);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // 读锁
    if (pathname === '/rwlock/acquire-read' && method === 'POST') {
      const body = await readBody(req);
      const result = lockManager.acquireReadLock(body.key, body.clientId, body.ttl);
      return sendJSON(res, result.success ? 200 : 423, result);
    }

    // 写锁
    if (pathname === '/rwlock/acquire-write' && method === 'POST') {
      const body = await readBody(req);
      const result = lockManager.acquireWriteLock(body.key, body.clientId, body.ttl);
      return sendJSON(res, result.success ? 200 : 423, result);
    }

    // 释放读写锁
    if (pathname === '/rwlock/release' && method === 'POST') {
      const body = await readBody(req);
      const result = lockManager.releaseRWLock(body.key, body.clientId, body.token, body.type);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // 状态监控
    if (pathname === '/status' && method === 'GET') {
      return sendJSON(res, 200, lockManager.getStatus());
    }

    // 健康检查
    if (pathname === '/health') {
      return sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
    }

    sendJSON(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('错误:', err);
    sendJSON(res, 500, { error: err.message });
  }
});

const PORT = process.env.PORT || 3097;
server.listen(PORT, () => {
  console.log(`分布式锁服务已启动: http://localhost:${PORT}`);
  console.log('API 端点:');
  console.log('  POST /lock/acquire        - 获取互斥锁');
  console.log('  POST /lock/release        - 释放互斥锁');
  console.log('  POST /lock/renew          - 锁续期');
  console.log('  POST /rwlock/acquire-read - 获取读锁');
  console.log('  POST /rwlock/acquire-write- 获取写锁');
  console.log('  POST /rwlock/release      - 释放读写锁');
  console.log('  GET  /status              - 查看锁状态');
});
