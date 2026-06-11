/**
 * API 网关 (API Gateway)
 *
 * 功能：
 * - 统一入口，反向代理到各微服务
 * - 基于服务注册中心的服务发现与负载均衡
 * - 请求限流 (Rate Limiting)
 * - 认证中间件（简易 JWT）
 * - 请求日志
 * - 熔断器 (Circuit Breaker)
 */

const http = require('http');
const https = require('https');

// ============================================================
// 配置
// ============================================================

const REGISTRY_HOST = process.env.REGISTRY_HOST || '127.0.0.1';
const REGISTRY_PORT = process.env.REGISTRY_PORT || 4000;
const GATEWAY_PORT = process.env.GATEWAY_PORT || 8080;

// 路由映射: 前缀 -> 服务名称
const ROUTE_MAP = {
  '/api/users': 'user-service',
  '/api/orders': 'order-service',
  '/api/products': 'product-service',
};

// 限流配置
const RATE_LIMIT_WINDOW = 60000; // 60 秒窗口
const RATE_LIMIT_MAX = 100;      // 每窗口最大请求数
const rateLimitStore = {};        // { ip: { count, windowStart } }

// 熔断器状态
const circuitBreakers = {};       // { serviceName: { state, failCount, lastFailTime, cooldownUntil } }
const CB_FAILURE_THRESHOLD = 5;   // 连续失败次数阈值
const CB_COOLDOWN_PERIOD = 30000; // 熔断冷却时间 30s

// JWT 简易密钥（Demo 用途，非生产级）
const JWT_SECRET = 'microservices-demo-secret-2024';

// ============================================================
// 工具函数
// ============================================================

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function log(method, path, statusCode, duration, target) {
  const timestamp = new Date().toISOString();
  const targetStr = target ? ` -> ${target}` : '';
  console.log(
    `[Gateway] ${timestamp} ${method} ${path} ${statusCode} ${duration}ms${targetStr}`
  );
}

// ============================================================
// 限流器
// ============================================================

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitStore[ip] || now - rateLimitStore[ip].windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore[ip] = { count: 1, windowStart: now };
    return true;
  }
  rateLimitStore[ip].count++;
  return rateLimitStore[ip].count <= RATE_LIMIT_MAX;
}

// ============================================================
// 熔断器
// ============================================================

function getCircuitBreaker(serviceName) {
  if (!circuitBreakers[serviceName]) {
    circuitBreakers[serviceName] = {
      state: 'closed',     // closed | open | half-open
      failCount: 0,
      lastFailTime: 0,
      cooldownUntil: 0,
    };
  }
  return circuitBreakers[serviceName];
}

function recordSuccess(serviceName) {
  const cb = getCircuitBreaker(serviceName);
  cb.failCount = 0;
  cb.state = 'closed';
}

function recordFailure(serviceName) {
  const cb = getCircuitBreaker(serviceName);
  cb.failCount++;
  cb.lastFailTime = Date.now();
  if (cb.failCount >= CB_FAILURE_THRESHOLD) {
    cb.state = 'open';
    cb.cooldownUntil = Date.now() + CB_COOLDOWN_PERIOD;
    console.log(`[Gateway] 熔断器开启: ${serviceName}`);
  }
}

function canRequest(serviceName) {
  const cb = getCircuitBreaker(serviceName);
  if (cb.state === 'closed') return true;
  if (cb.state === 'open') {
    if (Date.now() >= cb.cooldownUntil) {
      cb.state = 'half-open';
      return true; // 放行一个请求试探
    }
    return false;
  }
  // half-open: 放行
  return true;
}

// ============================================================
// 服务发现
// ============================================================

function discoverService(serviceName) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: REGISTRY_HOST,
        port: REGISTRY_PORT,
        path: `/load-balance/${serviceName}?strategy=round-robin`,
        method: 'GET',
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.success && data.instance) {
              return resolve(data.instance);
            }
            reject(new Error(data.error || '服务未发现'));
          } catch {
            reject(new Error('解析服务发现响应失败'));
          }
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('服务发现超时'));
    });
    req.end();
  });
}

// ============================================================
// 反向代理
// ============================================================

function proxyRequest(targetInstance, clientReq, clientRes) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: targetInstance.host,
      port: targetInstance.port,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        'x-forwarded-for': clientReq.socket.remoteAddress,
        'x-forwarded-host': clientReq.headers.host,
        'x-gateway-timestamp': Date.now().toString(),
      },
      timeout: 10000,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes);
      proxyRes.on('end', () => resolve(proxyRes.statusCode));
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error('上游服务超时'));
    });

    // 透传请求体
    clientReq.pipe(proxyReq);
  });
}

// ============================================================
// 简易 JWT 认证
// ============================================================

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

function createToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    require('crypto')
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64')
  );
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = base64UrlEncode(
      require('crypto')
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64')
    );
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// 不需要认证的路径
const PUBLIC_PATHS = [
  '/api/users/login',
  '/api/users/register',
  '/api/products',
  '/health',
];

function isPublicPath(path) {
  return PUBLIC_PATHS.some((p) => path === p || (p.endsWith('/') ? path.startsWith(p) : path.startsWith(p + '?')));
}

// ============================================================
// HTTP 服务器
// ============================================================

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const method = req.method;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // --- 健康检查 ---
  if (method === 'GET' && path === '/health') {
    log(method, path, 200, Date.now() - startTime);
    return json(res, 200, {
      status: 'healthy',
      service: 'api-gateway',
      uptime: process.uptime(),
      circuitBreakers: Object.fromEntries(
        Object.entries(circuitBreakers).map(([k, v]) => [k, v.state])
      ),
    });
  }

  // --- 限流 ---
  const clientIp = req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    log(method, path, 429, Date.now() - startTime);
    return json(res, 429, { error: '请求过于频繁，请稍后再试' });
  }

  // --- 认证 ---
  if (!isPublicPath(path)) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token || !verifyToken(token)) {
      log(method, path, 401, Date.now() - startTime);
      return json(res, 401, { error: '未认证，请先登录' });
    }
    // 将用户信息注入 headers 传递给下游
    const userPayload = verifyToken(token);
    req.headers['x-user-id'] = (userPayload && userPayload.userId) || '';
    req.headers['x-user-name'] = (userPayload && userPayload.username) || '';
  }

  // --- 路由匹配 ---
  let matchedService = null;
  let matchedPrefix = '';
  for (const [prefix, serviceName] of Object.entries(ROUTE_MAP)) {
    if (path.startsWith(prefix)) {
      matchedService = serviceName;
      matchedPrefix = prefix;
      break;
    }
  }

  if (!matchedService) {
    log(method, path, 404, Date.now() - startTime);
    return json(res, 404, { error: '路由未找到' });
  }

  // --- 熔断器检查 ---
  if (!canRequest(matchedService)) {
    log(method, path, 503, Date.now() - startTime, `${matchedService} (circuit-open)`);
    return json(res, 503, {
      error: `服务 ${matchedService} 暂时不可用（熔断器开启）`,
    });
  }

  // --- 服务发现 ---
  let targetInstance;
  try {
    targetInstance = await discoverService(matchedService);
  } catch (err) {
    log(method, path, 503, Date.now() - startTime, matchedService);
    return json(res, 503, {
      error: `服务发现失败: ${matchedService} - ${err.message}`,
    });
  }

  // --- 反向代理 ---
  const target = `${targetInstance.host}:${targetInstance.port}`;
  try {
    const statusCode = await proxyRequest(targetInstance, req, res);
    log(method, path, statusCode, Date.now() - startTime, target);
    recordSuccess(matchedService);
  } catch (err) {
    recordFailure(matchedService);
    log(method, path, 502, Date.now() - startTime, target);
    if (!res.headersSent) {
      json(res, 502, {
        error: `上游服务异常: ${err.message}`,
      });
    }
  }
});

server.listen(GATEWAY_PORT, () => {
  console.log(`[Gateway] API 网关已启动: http://127.0.0.1:${GATEWAY_PORT}`);
  console.log(`[Gateway] 路由映射:`);
  for (const [prefix, service] of Object.entries(ROUTE_MAP)) {
    console.log(`  ${prefix} -> ${service}`);
  }
  console.log(`[Gateway] 注册中心: ${REGISTRY_HOST}:${REGISTRY_PORT}`);
});

// 导出工具函数供外部使用
module.exports = { createToken, verifyToken, discoverService };
