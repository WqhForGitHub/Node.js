/**
 * 服务注册中心 (Service Registry)
 *
 * 功能：
 * - 服务注册 / 注销
 * - 心跳检测（自动剔除不健康服务）
 * - 服务发现（按名称查询可用实例）
 * - 负载均衡（轮询 / 随机）
 */

const http = require('http');

// ============================================================
// 服务注册表数据结构
// ============================================================

/**
 * registry 结构:
 * {
 *   "user-service": {
 *     name: "user-service",
 *     instances: [
 *       {
 *         id: "user-service-3001",
 *         host: "127.0.0.1",
 *         port: 3001,
 *         weight: 1,
 *         status: "healthy",          // healthy | unhealthy
 *         metadata: {},
 *         registeredAt: 1718000000000,
 *         lastHeartbeat: 1718000060000
 *       }
 *     ]
 *   }
 * }
 */
const registry = {};

// 心跳超时阈值（毫秒），超过该时间无心跳则标记为不健康
const HEARTBEAT_TIMEOUT = 15000;
// 不健康实例自动清理时间（毫秒）
const UNHEALTHY_CLEANUP_INTERVAL = 30000;
// 轮询计数器
const roundRobinCounters = {};

// ============================================================
// 核心逻辑
// ============================================================

/**
 * 注册服务实例
 */
function registerService({ name, host, port, metadata = {} }) {
  if (!registry[name]) {
    registry[name] = { name, instances: [] };
    roundRobinCounters[name] = 0;
  }

  const id = `${name}-${host}-${port}`;

  // 检查是否已注册
  const existing = registry[name].instances.find((ins) => ins.id === id);
  if (existing) {
    // 已注册则刷新心跳
    existing.lastHeartbeat = Date.now();
    existing.status = 'healthy';
    return { id, action: 'heartbeat refreshed' };
  }

  const instance = {
    id,
    name,
    host,
    port,
    weight: 1,
    status: 'healthy',
    metadata,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };

  registry[name].instances.push(instance);
  console.log(`[Registry] 服务注册: ${id}`);
  return { id, action: 'registered' };
}

/**
 * 注销服务实例
 */
function deregisterService({ name, host, port }) {
  if (!registry[name]) return { action: 'not found' };

  const id = `${name}-${host}-${port}`;
  const before = registry[name].instances.length;
  registry[name].instances = registry[name].instances.filter((ins) => ins.id !== id);
  const after = registry[name].instances.length;

  if (after === 0) {
    delete registry[name];
    delete roundRobinCounters[name];
  }

  if (before > after) {
    console.log(`[Registry] 服务注销: ${id}`);
    return { id, action: 'deregistered' };
  }
  return { action: 'not found' };
}

/**
 * 心跳
 */
function heartbeat({ name, host, port }) {
  if (!registry[name]) return { action: 'not found' };

  const id = `${name}-${host}-${port}`;
  const instance = registry[name].instances.find((ins) => ins.id === id);
  if (!instance) return { action: 'not found' };

  instance.lastHeartbeat = Date.now();
  instance.status = 'healthy';
  return { id, action: 'heartbeat' };
}

/**
 * 发现服务 - 获取某个服务的所有健康实例
 */
function discoverService(name) {
  if (!registry[name]) return null;
  const healthy = registry[name].instances.filter((ins) => ins.status === 'healthy');
  if (healthy.length === 0) return null;
  return { name, instances: healthy };
}

/**
 * 负载均衡 - 轮询策略
 */
function roundRobin(name) {
  const service = discoverService(name);
  if (!service) return null;

  const instances = service.instances;
  const index = roundRobinCounters[name] % instances.length;
  roundRobinCounters[name]++;
  return instances[index];
}

/**
 * 负载均衡 - 随机策略
 */
function randomPick(name) {
  const service = discoverService(name);
  if (!service) return null;

  const instances = service.instances;
  const index = Math.floor(Math.random() * instances.length);
  return instances[index];
}

/**
 * 获取所有注册信息
 */
function getAllServices() {
  const result = {};
  for (const [name, service] of Object.entries(registry)) {
    result[name] = {
      name,
      instanceCount: service.instances.length,
      instances: service.instances.map((ins) => ({
        id: ins.id,
        host: ins.host,
        port: ins.port,
        status: ins.status,
        metadata: ins.metadata,
        registeredAt: ins.registeredAt,
        lastHeartbeat: ins.lastHeartbeat,
      })),
    };
  }
  return result;
}

// ============================================================
// 心跳检测 & 自动清理
// ============================================================

function checkHeartbeats() {
  const now = Date.now();
  for (const [name, service] of Object.entries(registry)) {
    for (const instance of service.instances) {
      if (now - instance.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        if (instance.status === 'healthy') {
          console.log(`[Registry] 心跳超时，标记为不健康: ${instance.id}`);
        }
        instance.status = 'unhealthy';
      }
    }
  }
}

function cleanupUnhealthy() {
  for (const [name, service] of Object.entries(registry)) {
    const before = service.instances.length;
    service.instances = service.instances.filter((ins) => ins.status === 'healthy');
    const removed = before - service.instances.length;
    if (removed > 0) {
      console.log(`[Registry] 清理不健康实例: ${name} 移除 ${removed} 个`);
    }
    if (service.instances.length === 0) {
      delete registry[name];
      delete roundRobinCounters[name];
    }
  }
}

// 每 5 秒检测一次心跳
setInterval(checkHeartbeats, 5000);
// 每 30 秒清理一次不健康实例
setInterval(cleanupUnhealthy, UNHEALTHY_CLEANUP_INTERVAL);

// ============================================================
// HTTP 服务器
// ============================================================

const PORT = process.env.REGISTRY_PORT || 4000;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  function json(code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  function readBody() {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  // --- 路由 ---

  // POST /register    注册服务
  if (method === 'POST' && path === '/register') {
    return readBody().then((data) => {
      const { name, host, port, metadata } = data;
      if (!name || !host || !port) {
        return json(400, { error: 'name, host, port 必填' });
      }
      const result = registerService({ name, host, port, metadata });
      json(200, { success: true, ...result });
    });
  }

  // POST /deregister  注销服务
  if (method === 'POST' && path === '/deregister') {
    return readBody().then((data) => {
      const { name, host, port } = data;
      if (!name || !host || !port) {
        return json(400, { error: 'name, host, port 必填' });
      }
      const result = deregisterService({ name, host, port });
      json(200, { success: true, ...result });
    });
  }

  // POST /heartbeat   心跳
  if (method === 'POST' && path === '/heartbeat') {
    return readBody().then((data) => {
      const { name, host, port } = data;
      if (!name || !host || !port) {
        return json(400, { error: 'name, host, port 必填' });
      }
      const result = heartbeat({ name, host, port });
      json(200, { success: true, ...result });
    });
  }

  // GET /discover/:name  发现服务
  if (method === 'GET' && path.startsWith('/discover/')) {
    const name = path.replace('/discover/', '');
    const service = discoverService(name);
    if (!service) {
      return json(404, { error: `服务 ${name} 未发现` });
    }
    return json(200, { success: true, service });
  }

  // GET /load-balance/:name?strategy=round-robin|random  负载均衡
  if (method === 'GET' && path.startsWith('/load-balance/')) {
    const name = path.replace('/load-balance/', '');
    const strategy = url.searchParams.get('strategy') || 'round-robin';
    const instance = strategy === 'random' ? randomPick(name) : roundRobin(name);
    if (!instance) {
      return json(404, { error: `服务 ${name} 无可用实例` });
    }
    return json(200, { success: true, instance });
  }

  // GET /services  所有服务列表
  if (method === 'GET' && path === '/services') {
    return json(200, { success: true, services: getAllServices() });
  }

  // GET /health  健康检查
  if (method === 'GET' && path === '/health') {
    return json(200, {
      status: 'healthy',
      service: 'service-registry',
      uptime: process.uptime(),
      totalServices: Object.keys(registry).length,
      totalInstances: Object.values(registry).reduce((sum, s) => sum + s.instances.length, 0),
    });
  }

  // 404
  json(404, { error: '路由未找到' });
});

server.listen(PORT, () => {
  console.log(`[Registry] 服务注册中心已启动: http://127.0.0.1:${PORT}`);
  console.log(`[Registry] 注册地址:   POST /register`);
  console.log(`[Registry] 注销地址:   POST /deregister`);
  console.log(`[Registry] 心跳地址:   POST /heartbeat`);
  console.log(`[Registry] 发现地址:   GET  /discover/:name`);
  console.log(`[Registry] 负载均衡:   GET  /load-balance/:name`);
  console.log(`[Registry] 服务列表:   GET  /services`);
});

module.exports = {
  registerService,
  deregisterService,
  discoverService,
  roundRobin,
  randomPick,
};
