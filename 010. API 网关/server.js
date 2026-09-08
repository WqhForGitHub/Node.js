/**
 * API 网关 - 纯 Node.js 实现
 *
 * 功能:
 *   - 路由配置与管理 (基于路径前缀的路由)
 *   - 反向代理 (请求转发到后端服务)
 *   - 负载均衡 (轮询 / 随机 / 最少连接)
 *   - 限流 (基于 IP / 基于路由)
 *   - 认证中间件 (API Key / Bearer Token)
 *   - 熔断器 (Circuit Breaker)
 *   - 请求/响应日志
 *   - 健康检查与自动摘除
 *   - 请求重试
 *   - CORS 处理
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');

// ==================== 配置 ====================

const PORT = 3800;
const DATA_DIR = path.join(__dirname, 'data');
const HEALTH_CHECK_INTERVAL = 30000; // 健康检查间隔: 30秒
const HEALTH_CHECK_TIMEOUT = 5000; // 健康检查超时: 5秒
const CIRCUIT_BREAKER_THRESHOLD = 5; // 熔断器失败阈值
const CIRCUIT_BREAKER_RESET_TIME = 30000; // 熔断器恢复时间: 30秒
const RETRY_COUNT = 2; // 请求重试次数
const RETRY_DELAY = 500; // 重试延迟: 500ms

// ==================== 数据层 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const routesFile = path.join(DATA_DIR, 'routes.json');
const apiKeysFile = path.join(DATA_DIR, 'api_keys.json');
const logsFile = path.join(DATA_DIR, 'access_logs.json');

function loadRoutes() {
  return readJson(routesFile);
}
function saveRoutes(data) {
  writeJson(routesFile, data);
}
function loadApiKeys() {
  return readJson(apiKeysFile);
}
function saveApiKeys(data) {
  writeJson(apiKeysFile, data);
}
function loadLogs() {
  return readJson(logsFile);
}
function saveLogs(data) {
  writeJson(logsFile, data);
}

// ==================== 工具函数 ====================

function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('无效的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendSuccess(res, data) {
  sendJson(res, 200, { success: true, data });
}

function sendError(res, status, error) {
  sendJson(res, status, { success: false, error });
}

function parsePath(requestUrl) {
  const parsed = url.parse(requestUrl, true);
  return parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
}

// ==================== CORS 处理 ====================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }
  return false;
}

// ==================== 限流器 ====================

const rateLimitStore = new Map();

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now - record.startTime > windowMs) {
    rateLimitStore.set(key, { startTime: now, count: 1 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  record.count++;
  if (record.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.startTime + windowMs,
    };
  }
  return {
    allowed: true,
    remaining: limit - record.count,
    resetAt: record.startTime + windowMs,
  };
}

// ==================== 熔断器 ====================

const circuitBreakerStore = new Map();

function getCircuitBreaker(serviceId) {
  if (!circuitBreakerStore.has(serviceId)) {
    circuitBreakerStore.set(serviceId, {
      state: 'closed', // closed | open | half-open
      failures: 0,
      lastFailure: null,
      openedAt: null,
    });
  }
  return circuitBreakerStore.get(serviceId);
}

function recordSuccess(serviceId) {
  const cb = getCircuitBreaker(serviceId);
  cb.failures = 0;
  cb.state = 'closed';
}

function recordFailure(serviceId) {
  const cb = getCircuitBreaker(serviceId);
  cb.failures++;
  cb.lastFailure = new Date().toISOString();

  if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.state = 'open';
    cb.openedAt = Date.now();
  }
}

function isCircuitOpen(serviceId) {
  const cb = getCircuitBreaker(serviceId);
  if (cb.state === 'closed') return false;
  if (cb.state === 'open') {
    // 检查是否可以进入 half-open
    if (Date.now() - cb.openedAt > CIRCUIT_BREAKER_RESET_TIME) {
      cb.state = 'half-open';
      return false;
    }
    return true;
  }
  // half-open: 允许一个请求通过
  return false;
}

// ==================== 负载均衡 ====================

const roundRobinCounters = new Map();

function selectTarget(serviceId, targets, strategy) {
  if (!targets || targets.length === 0) return null;

  switch (strategy) {
    case 'random': {
      return targets[Math.floor(Math.random() * targets.length)];
    }
    case 'least-connections': {
      // 选择连接数最少的
      let minConn = Infinity;
      let selected = targets[0];
      for (const t of targets) {
        const conn = t.activeConnections || 0;
        if (conn < minConn) {
          minConn = conn;
          selected = t;
        }
      }
      return selected;
    }
    case 'round-robin':
    default: {
      const idx = (roundRobinCounters.get(serviceId) || 0) % targets.length;
      roundRobinCounters.set(serviceId, idx + 1);
      return targets[idx];
    }
  }
}

// ==================== 代理请求 ====================

function proxyRequest(target, req, requestBody) {
  return new Promise((resolve, reject) => {
    const parsedTarget = new URL(target.url);
    const parsedUrl = url.parse(req.url, true);

    const options = {
      hostname: parsedTarget.hostname,
      port: parsedTarget.port,
      path: parsedUrl.path,
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedTarget.host,
        'x-forwarded-for': req.socket.remoteAddress,
        'x-forwarded-proto': 'http',
        'x-forwarded-host': req.headers.host || '',
      },
    };

    // 删除可能导致问题的头
    delete options.headers['content-length'];

    const proxyReq = http.request(options, (proxyRes) => {
      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        resolve({
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      reject(new Error('上游请求超时'));
    });

    if (requestBody) {
      proxyReq.write(requestBody);
    }
    proxyReq.end();
  });
}

// ==================== 健康检查 ====================

async function checkTargetHealth(target) {
  return new Promise((resolve) => {
    const parsedTarget = new URL(target.url);
    const options = {
      hostname: parsedTarget.hostname,
      port: parsedTarget.port,
      path: '/health',
      method: 'GET',
      timeout: HEALTH_CHECK_TIMEOUT,
    };

    const healthReq = http.request(options, (healthRes) => {
      resolve(healthRes.statusCode === 200);
    });

    healthReq.on('error', () => resolve(false));
    healthReq.on('timeout', () => {
      healthReq.destroy();
      resolve(false);
    });

    healthReq.end();
  });
}

async function runHealthChecks() {
  const routes = loadRoutes();
  for (const route of routes) {
    for (const target of route.targets) {
      const healthy = await checkTargetHealth(target);
      target.healthy = healthy;
      if (!healthy) {
        console.log(`  [健康检查] ${target.url} 不可达`);
      }
    }
  }
  saveRoutes(routes);
}

// ==================== 访问日志 ====================

function logAccess(routeId, target, req, statusCode, duration) {
  const logs = loadLogs();
  logs.push({
    id: generateId(),
    routeId,
    target: target ? target.url : null,
    method: req.method,
    path: url.parse(req.url).pathname,
    statusCode,
    duration,
    clientIp: req.socket.remoteAddress,
    timestamp: new Date().toISOString(),
  });
  // 只保留最近 1000 条
  if (logs.length > 1000) logs.splice(0, logs.length - 1000);
  saveLogs(logs);
}

// ==================== API Key 认证 ====================

function validateApiKey(key) {
  const apiKeys = loadApiKeys();
  const now = new Date().toISOString();
  return (
    apiKeys.find((k) => k.key === key && k.active && (!k.expiresAt || k.expiresAt > now)) || null
  );
}

function authenticateRequest(req) {
  // 1. 检查 X-API-Key 头
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const keyData = validateApiKey(apiKey);
    if (keyData) return { authenticated: true, method: 'api_key', key: keyData };
  }

  // 2. 检查 Bearer Token
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token) return { authenticated: true, method: 'bearer', token };
  }

  return { authenticated: false };
}

// ==================== 路由匹配 ====================

function matchRoute(pathname) {
  const routes = loadRoutes();
  // 按路径长度降序排列，确保最长匹配优先
  const sorted = [...routes].sort((a, b) => b.path.length - a.path.length);
  for (const route of sorted) {
    if (
      pathname === route.path ||
      pathname.startsWith(route.path + '/') ||
      pathname.startsWith(route.path + '?')
    ) {
      return route;
    }
  }
  return null;
}

// ==================== 请求处理 ====================

async function handleGatewayRequest(req, res) {
  const startTime = Date.now();
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 匹配路由
  const route = matchRoute(pathname);
  if (!route) {
    return sendError(res, 404, `没有匹配的路由: ${pathname}`);
  }

  // 认证检查
  if (route.authRequired) {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return sendError(res, 401, '需要认证 (API Key 或 Bearer Token)');
    }
  }

  // 限流
  if (route.rateLimit) {
    const clientIp = req.socket.remoteAddress;
    const limitKey = `${route.id}:${clientIp}`;
    const rlResult = checkRateLimit(limitKey, route.rateLimit, 60000);
    res.setHeader('X-RateLimit-Limit', route.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rlResult.remaining);
    res.setHeader('X-RateLimit-Reset', rlResult.resetAt);
    if (!rlResult.allowed) {
      return sendError(res, 429, '请求过于频繁');
    }
  }

  // 获取健康的目标
  const healthyTargets = route.targets.filter((t) => t.healthy !== false);
  if (healthyTargets.length === 0) {
    return sendError(res, 503, `服务不可用: ${route.name}`);
  }

  // 熔断器检查
  if (isCircuitOpen(route.id)) {
    return sendError(res, 503, `服务熔断中: ${route.name}，请稍后重试`);
  }

  // 负载均衡选择目标
  const target = selectTarget(route.id, healthyTargets, route.loadBalance || 'round-robin');
  if (!target) {
    return sendError(res, 503, '没有可用的后端服务');
  }

  // 读取请求体
  let requestBody = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  // 代理请求 (带重试)
  let lastError = null;
  let proxyResult = null;
  let attemptTarget = target;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      proxyResult = await proxyRequest(attemptTarget, req, requestBody);
      recordSuccess(route.id);
      break;
    } catch (err) {
      lastError = err;
      recordFailure(route.id);
      console.log(
        `  [代理失败] ${attemptTarget.url} - ${err.message} (尝试 ${attempt + 1}/${RETRY_COUNT + 1})`
      );
      if (attempt < RETRY_COUNT) {
        // 选择另一个目标重试
        const otherTargets = healthyTargets.filter((t) => t.url !== attemptTarget.url);
        if (otherTargets.length > 0) {
          attemptTarget = otherTargets[Math.floor(Math.random() * otherTargets.length)];
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  const duration = Date.now() - startTime;
  logAccess(route.id, attemptTarget, req, proxyResult ? proxyResult.statusCode : 502, duration);

  if (!proxyResult) {
    return sendError(res, 502, `上游服务错误: ${lastError ? lastError.message : '未知错误'}`);
  }

  // 返回代理响应
  const responseHeaders = { ...proxyResult.headers };
  delete responseHeaders['transfer-encoding'];
  responseHeaders['x-proxy-duration'] = `${duration}ms`;
  responseHeaders['x-proxy-target'] = attemptTarget.url;

  res.writeHead(proxyResult.statusCode, responseHeaders);
  res.end(proxyResult.body);
}

// ==================== 管理接口 ====================

// --- 路由管理 ---

async function createRoute(req, res) {
  const body = await parseBody(req);
  const { name, path: routePath, targets, authRequired, rateLimit, loadBalance } = body;

  if (!name || !routePath) return sendError(res, 400, '路由名称和路径不能为空');
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return sendError(res, 400, '至少需要一个后端目标');
  }

  const route = {
    id: generateId(),
    name,
    path: routePath.startsWith('/') ? routePath : '/' + routePath,
    targets: targets.map((t) => ({
      url: t.url,
      healthy: true,
      activeConnections: 0,
    })),
    authRequired: authRequired || false,
    rateLimit: rateLimit || 0,
    loadBalance: loadBalance || 'round-robin',
    createdAt: new Date().toISOString(),
  };

  const routes = loadRoutes();
  routes.push(route);
  saveRoutes(routes);

  sendJson(res, 201, { success: true, data: route });
}

function listRoutes(req, res) {
  const routes = loadRoutes();
  sendSuccess(res, routes);
}

function getRoute(req, res, routeId) {
  const routes = loadRoutes();
  const route = routes.find((r) => r.id === routeId);
  if (!route) return sendError(res, 404, '路由不存在');
  sendSuccess(res, route);
}

async function updateRoute(req, res, routeId) {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return sendError(res, 404, '路由不存在');

  const body = await parseBody(req);
  const route = routes[idx];

  if (body.name !== undefined) route.name = body.name;
  if (body.path !== undefined) route.path = body.path.startsWith('/') ? body.path : '/' + body.path;
  if (body.authRequired !== undefined) route.authRequired = body.authRequired;
  if (body.rateLimit !== undefined) route.rateLimit = body.rateLimit;
  if (body.loadBalance !== undefined) route.loadBalance = body.loadBalance;
  if (body.targets !== undefined) {
    route.targets = body.targets.map((t) => ({
      url: t.url,
      healthy: true,
      activeConnections: 0,
    }));
  }

  routes[idx] = route;
  saveRoutes(routes);
  sendSuccess(res, route);
}

function deleteRoute(req, res, routeId) {
  const routes = loadRoutes();
  const idx = routes.findIndex((r) => r.id === routeId);
  if (idx === -1) return sendError(res, 404, '路由不存在');

  routes.splice(idx, 1);
  saveRoutes(routes);
  sendSuccess(res, { message: '路由已删除' });
}

// --- API Key 管理 ---

async function createApiKey(req, res) {
  const body = await parseBody(req);
  const { name, expiresAt } = body;

  if (!name) return sendError(res, 400, 'API Key 名称不能为空');

  const apiKey = {
    id: generateId(),
    name,
    key: `gw_${crypto.randomBytes(24).toString('hex')}`,
    active: true,
    expiresAt: expiresAt || null,
    createdAt: new Date().toISOString(),
  };

  const keys = loadApiKeys();
  keys.push(apiKey);
  saveApiKeys(keys);

  sendJson(res, 201, { success: true, data: apiKey });
}

function listApiKeys(req, res) {
  const keys = loadApiKeys().map((k) => ({
    id: k.id,
    name: k.name,
    key: k.key,
    active: k.active,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));
  sendSuccess(res, keys);
}

function revokeApiKey(req, res, keyId) {
  const keys = loadApiKeys();
  const idx = keys.findIndex((k) => k.id === keyId);
  if (idx === -1) return sendError(res, 404, 'API Key 不存在');

  keys[idx].active = false;
  saveApiKeys(keys);
  sendSuccess(res, { message: 'API Key 已撤销' });
}

// --- 访问日志 ---

function getAccessLogs(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const limit = Math.min(parseInt(parsedUrl.query.limit) || 50, 200);
  const logs = loadLogs();
  const recent = logs.slice(-limit).reverse();
  sendSuccess(res, recent);
}

// --- 熔断器状态 ---

function getCircuitBreakerStatus(req, res) {
  const status = {};
  for (const [serviceId, cb] of circuitBreakerStore) {
    status[serviceId] = {
      state: cb.state,
      failures: cb.failures,
      lastFailure: cb.lastFailure,
      openedAt: cb.openedAt,
    };
  }
  sendSuccess(res, status);
}

// --- 限流状态 ---

function getRateLimitStatus(req, res) {
  const status = {};
  for (const [key, record] of rateLimitStore) {
    status[key] = {
      count: record.count,
      startTime: new Date(record.startTime).toISOString(),
    };
  }
  sendSuccess(res, status);
}

// --- 健康检查 ---

function healthCheck(req, res) {
  const routes = loadRoutes();
  const totalTargets = routes.reduce((sum, r) => sum + r.targets.length, 0);
  const healthyTargets = routes.reduce(
    (sum, r) => sum + r.targets.filter((t) => t.healthy !== false).length,
    0
  );

  sendSuccess(res, {
    service: 'API 网关',
    status: 'healthy',
    uptime: process.uptime(),
    routes: routes.length,
    targets: { total: totalTargets, healthy: healthyTargets },
    timestamp: new Date().toISOString(),
  });
}

// ==================== 请求路由 ====================

async function handleRequest(req, res) {
  // CORS
  if (handleCors(req, res)) return;
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const method = req.method;
  const pathname = url.parse(req.url, true).pathname;
  const segments = parsePath(req.url);

  try {
    // 健康检查
    if (segments.length === 1 && segments[0] === 'health' && method === 'GET') {
      return healthCheck(req, res);
    }

    // 管理接口前缀 /gateway/
    if (segments[0] === 'gateway') {
      // 路由管理
      if (segments[1] === 'routes') {
        if (method === 'GET' && !segments[2]) return listRoutes(req, res);
        if (method === 'GET' && segments[2]) return getRoute(req, res, segments[2]);
        if (method === 'POST') return await createRoute(req, res);
        if (method === 'PUT' && segments[2]) return await updateRoute(req, res, segments[2]);
        if (method === 'DELETE' && segments[2]) return deleteRoute(req, res, segments[2]);
      }

      // API Key 管理
      if (segments[1] === 'keys') {
        if (method === 'GET') return listApiKeys(req, res);
        if (method === 'POST') return await createApiKey(req, res);
        if (method === 'DELETE' && segments[2]) return revokeApiKey(req, res, segments[2]);
      }

      // 访问日志
      if (segments[1] === 'logs' && method === 'GET') {
        return getAccessLogs(req, res);
      }

      // 熔断器状态
      if (segments[1] === 'circuit-breakers' && method === 'GET') {
        return getCircuitBreakerStatus(req, res);
      }

      // 限流状态
      if (segments[1] === 'rate-limits' && method === 'GET') {
        return getRateLimitStatus(req, res);
      }

      return sendError(res, 404, '管理接口不存在');
    }

    // 所有其他请求走网关代理
    return await handleGatewayRequest(req, res);
  } catch (err) {
    console.error('网关错误:', err);
    sendError(res, 500, '网关内部错误');
  }
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  const routes = loadRoutes();
  if (routes.length === 0) {
    const defaultRoutes = [
      {
        id: generateId(),
        name: '用户服务',
        path: '/api/users',
        targets: [
          { url: 'http://localhost:3001', healthy: true, activeConnections: 0 },
          { url: 'http://localhost:3002', healthy: true, activeConnections: 0 },
        ],
        authRequired: true,
        rateLimit: 100,
        loadBalance: 'round-robin',
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: '订单服务',
        path: '/api/orders',
        targets: [{ url: 'http://localhost:4001', healthy: true, activeConnections: 0 }],
        authRequired: true,
        rateLimit: 50,
        loadBalance: 'round-robin',
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: '商品服务',
        path: '/api/products',
        targets: [
          { url: 'http://localhost:5001', healthy: true, activeConnections: 0 },
          { url: 'http://localhost:5002', healthy: true, activeConnections: 0 },
          { url: 'http://localhost:5003', healthy: true, activeConnections: 0 },
        ],
        authRequired: false,
        rateLimit: 200,
        loadBalance: 'least-connections',
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: '公共 API',
        path: '/api/public',
        targets: [{ url: 'http://localhost:6001', healthy: true, activeConnections: 0 }],
        authRequired: false,
        rateLimit: 0,
        loadBalance: 'round-robin',
        createdAt: new Date().toISOString(),
      },
    ];
    saveRoutes(defaultRoutes);
  }

  const apiKeys = loadApiKeys();
  if (apiKeys.length === 0) {
    const defaultKeys = [
      {
        id: generateId(),
        name: '测试 API Key',
        key: `gw_${crypto.randomBytes(24).toString('hex')}`,
        active: true,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      },
    ];
    saveApiKeys(defaultKeys);
  }
}

// ==================== 启动服务器 ====================

initDefaultData();

const server = http.createServer(handleRequest);

// 定时健康检查
const healthCheckTimer = setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL);

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║            API 网关已启动                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log('');
  console.log('  管理接口:');
  console.log('  ├─ GET    /gateway/routes              路由列表');
  console.log('  ├─ POST   /gateway/routes              创建路由');
  console.log('  ├─ GET    /gateway/routes/:id          路由详情');
  console.log('  ├─ PUT    /gateway/routes/:id          更新路由');
  console.log('  ├─ DELETE /gateway/routes/:id          删除路由');
  console.log('  ├─ GET    /gateway/keys                API Key 列表');
  console.log('  ├─ POST   /gateway/keys                创建 API Key');
  console.log('  ├─ DELETE /gateway/keys/:id            撤销 API Key');
  console.log('  ├─ GET    /gateway/logs                访问日志');
  console.log('  ├─ GET    /gateway/circuit-breakers    熔断器状态');
  console.log('  └─ GET    /gateway/rate-limits         限流状态');
  console.log('');
  console.log('  网关代理:');
  console.log('  └─ *      匹配已配置路由的请求将被代理转发');
  console.log('');
  console.log('  负载均衡策略: round-robin | random | least-connections');
  console.log('  认证方式: X-API-Key | Authorization: Bearer');
  console.log('');
  console.log('  默认路由:');
  console.log('  ├─ /api/users    → 用户服务 (需认证, 限流100/min)');
  console.log('  ├─ /api/orders   → 订单服务 (需认证, 限流50/min)');
  console.log('  ├─ /api/products → 商品服务 (不限认证, 限流200/min)');
  console.log('  └─ /api/public   → 公共 API (无限制)');
  console.log('');
  console.log('  健康检查: http://localhost:' + PORT + '/health');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭 API 网关...');
  clearInterval(healthCheckTimer);
  server.close(() => {
    console.log('API 网关已关闭');
    process.exit(0);
  });
});
