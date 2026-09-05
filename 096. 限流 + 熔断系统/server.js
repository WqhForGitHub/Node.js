// 限流 + 熔断系统 - 纯 Node.js 实现
// 限流算法: 令牌桶 / 漏桶 / 滑动窗口 / 固定窗口
// 熔断: 三态机 CLOSED -> OPEN -> HALF_OPEN
const http = require('http');
const url = require('url');

// ========= 1. 令牌桶 =========
class TokenBucket {
  constructor({ capacity = 10, refillPerSec = 2 }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSec = refillPerSec;
    this.last = Date.now();
  }
  tryConsume(n = 1) {
    const now = Date.now();
    const delta = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.refillPerSec);
    this.last = now;
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }
  state() {
    return { algo: 'token-bucket', tokens: +this.tokens.toFixed(2), capacity: this.capacity };
  }
}

// ========= 2. 漏桶 =========
class LeakyBucket {
  constructor({ capacity = 10, leakPerSec = 2 }) {
    this.capacity = capacity;
    this.water = 0;
    this.leakPerSec = leakPerSec;
    this.last = Date.now();
  }
  tryConsume() {
    const now = Date.now();
    const leaked = ((now - this.last) / 1000) * this.leakPerSec;
    this.water = Math.max(0, this.water - leaked);
    this.last = now;
    if (this.water + 1 <= this.capacity) {
      this.water += 1;
      return true;
    }
    return false;
  }
  state() {
    return { algo: 'leaky-bucket', water: +this.water.toFixed(2), capacity: this.capacity };
  }
}

// ========= 3. 固定窗口 =========
class FixedWindow {
  constructor({ windowMs = 1000, max = 5 }) {
    this.windowMs = windowMs;
    this.max = max;
    this.windowStart = Date.now();
    this.count = 0;
  }
  tryConsume() {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count < this.max) {
      this.count++;
      return true;
    }
    return false;
  }
  state() {
    return { algo: 'fixed-window', count: this.count, max: this.max, windowMs: this.windowMs };
  }
}

// ========= 4. 滑动窗口(基于时间戳数组) =========
class SlidingWindow {
  constructor({ windowMs = 1000, max = 5 }) {
    this.windowMs = windowMs;
    this.max = max;
    this.timestamps = [];
  }
  tryConsume() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    while (this.timestamps.length && this.timestamps[0] < cutoff) this.timestamps.shift();
    if (this.timestamps.length < this.max) {
      this.timestamps.push(now);
      return true;
    }
    return false;
  }
  state() {
    return {
      algo: 'sliding-window',
      count: this.timestamps.length,
      max: this.max,
      windowMs: this.windowMs,
    };
  }
}

// ========= 熔断器 =========
class CircuitBreaker {
  constructor({ name, failureThreshold = 5, halfOpenAfterMs = 5000, halfOpenMaxCalls = 2 }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.halfOpenAfterMs = halfOpenAfterMs;
    this.halfOpenMaxCalls = halfOpenMaxCalls;
    this.state = 'CLOSED'; // CLOSED / OPEN / HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.openedAt = 0;
    this.halfOpenCalls = 0;
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.totalShortCircuits = 0;
  }

  async exec(fn) {
    this.totalCalls++;
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.halfOpenAfterMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      } else {
        this.totalShortCircuits++;
        throw new Error('CircuitBreaker OPEN: short-circuit');
      }
    }
    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      this.totalShortCircuits++;
      throw new Error('CircuitBreaker HALF_OPEN: probe limit');
    }
    if (this.state === 'HALF_OPEN') this.halfOpenCalls++;

    try {
      const r = await fn();
      this.onSuccess();
      return r;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.halfOpenMaxCalls) {
        // 探针全部成功, 关闭
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }
  onFailure() {
    this.totalFailures++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.successes = 0;
      return;
    }
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  status() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalShortCircuits: this.totalShortCircuits,
      openedAt: this.openedAt,
      msSinceOpen: this.openedAt ? Date.now() - this.openedAt : null,
    };
  }
}

// ========= 限流器注册表 =========
const limiters = {
  tb: new TokenBucket({ capacity: 5, refillPerSec: 2 }),
  lb: new LeakyBucket({ capacity: 5, leakPerSec: 2 }),
  fw: new FixedWindow({ windowMs: 1000, max: 5 }),
  sw: new SlidingWindow({ windowMs: 1000, max: 5 }),
};

// 按 IP 的限流(用于 /protected 接口演示)
const ipLimiters = new Map();
function getIpLimiter(ip) {
  if (!ipLimiters.has(ip)) {
    ipLimiters.set(ip, new SlidingWindow({ windowMs: 1000, max: 3 }));
  }
  return ipLimiters.get(ip);
}

// ========= 熔断器 =========
const breakers = {
  flaky: new CircuitBreaker({ name: 'flaky', failureThreshold: 3, halfOpenAfterMs: 5000 }),
};

// 模拟一个不稳定的依赖服务
let flakyMode = 'normal'; // normal / fail
async function callFlakyService() {
  await new Promise((r) => setTimeout(r, 30));
  if (flakyMode === 'fail') throw new Error('upstream failure');
  return { ok: true, data: 'hello from flaky' };
}

// ========= HTTP =========
function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const { pathname, query } = url.parse(req.url, true);
  const ip = req.socket.remoteAddress;

  if (pathname === '/') {
    return send(res, 200, {
      name: '限流 + 熔断系统',
      port: 3096,
      endpoints: [
        'GET /limit/:algo                测试限流 (algo=tb|lb|fw|sw)',
        'GET /protected                  按 IP 滑窗限流 (3 req/s)',
        'GET /breaker/call               经过熔断器调用 flaky 服务',
        'GET /breaker/mode?mode=fail     设置 flaky 服务为失败模式',
        'GET /breaker/mode?mode=normal   恢复正常',
        'GET /status                     全局状态',
      ],
    });
  }

  if (pathname.startsWith('/limit/')) {
    const algo = pathname.split('/')[2];
    const lim = limiters[algo];
    if (!lim) return send(res, 400, { error: 'unknown algo' });
    if (lim.tryConsume()) return send(res, 200, { allowed: true, ...lim.state() });
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({ allowed: false, error: 'rate limited', ...lim.state() }, null, 2)
    );
  }

  if (pathname === '/protected') {
    const lim = getIpLimiter(ip);
    if (!lim.tryConsume()) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'rate limited', ip, ...lim.state() }));
    }
    return send(res, 200, { ok: true, ip, msg: 'protected resource', ...lim.state() });
  }

  if (pathname === '/breaker/call') {
    const br = breakers.flaky;
    try {
      const r = await br.exec(callFlakyService);
      return send(res, 200, { ok: true, result: r, breaker: br.status() });
    } catch (e) {
      return send(res, 503, { ok: false, error: e.message, breaker: br.status() });
    }
  }

  if (pathname === '/breaker/mode') {
    flakyMode = query.mode === 'fail' ? 'fail' : 'normal';
    return send(res, 200, { flakyMode });
  }

  if (pathname === '/breaker/reset') {
    breakers.flaky = new CircuitBreaker({
      name: 'flaky',
      failureThreshold: 3,
      halfOpenAfterMs: 5000,
    });
    return send(res, 200, { ok: true });
  }

  if (pathname === '/status') {
    return send(res, 200, {
      limiters: Object.fromEntries(Object.entries(limiters).map(([k, v]) => [k, v.state()])),
      breakers: Object.fromEntries(Object.entries(breakers).map(([k, v]) => [k, v.status()])),
      flakyMode,
      ipLimitersCount: ipLimiters.size,
    });
  }

  send(res, 404, { error: 'Not Found' });
});

const PORT = 3096;
server.listen(PORT, () => {
  console.log(`[限流+熔断] http://localhost:${PORT}`);
  console.log('限流测试: for i in 1..10; curl http://localhost:3096/limit/tb');
  console.log(
    '熔断测试: curl "http://localhost:3096/breaker/mode?mode=fail" 然后多次访问 /breaker/call'
  );
});
