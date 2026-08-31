/**
 * 服务发现系统 - 纯 Node.js 实现
 *
 * 功能:
 *   - 服务发现 (按名称/标签/元数据查询)
 *   - DNS 风格服务解析 (service-name.protocol.port)
 *   - 负载均衡策略 (轮询 / 随机 / 加权 / 最少连接 / 一致性哈希)
 *   - 服务健康监控 (主动探测 + 被动标记)
 *   - 服务缓存层 (TTL 过期自动刷新)
 *   - 服务订阅/通知 (服务变更实时推送)
 *   - 服务分组与命名空间
 *   - 服务版本路由 (灰度/金丝雀发布)
 *   - 服务依赖分析
 *   - 客户端连接管理
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 配置 ====================

const PORT = 4000;
const DATA_DIR = path.join(__dirname, 'data');
const CACHE_TTL = 10000; // 缓存 TTL: 10秒
const HEALTH_CHECK_INTERVAL = 20000; // 健康检查间隔: 20秒
const HEALTH_CHECK_TIMEOUT = 5000; // 健康检查超时: 5秒
const SUBSCRIBER_TIMEOUT = 60000; // 订阅者超时: 60秒

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

const servicesFile = path.join(DATA_DIR, 'services.json');
const namespacesFile = path.join(DATA_DIR, 'namespaces.json');
const subscribersFile = path.join(DATA_DIR, 'subscribers.json');
const probeResultsFile = path.join(DATA_DIR, 'probe_results.json');

function loadServices() {
  return readJson(servicesFile);
}
function saveServices(data) {
  writeJson(servicesFile, data);
}
function loadNamespaces() {
  return readJson(namespacesFile);
}
function saveNamespaces(data) {
  writeJson(namespacesFile, data);
}
function loadSubscribers() {
  return readJson(subscribersFile);
}
function saveSubscribers(data) {
  writeJson(subscribersFile, data);
}
function loadProbeResults() {
  return readJson(probeResultsFile);
}
function saveProbeResults(data) {
  writeJson(probeResultsFile, data);
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// ==================== 缓存层 ====================

const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttl) {
  cache.set(key, { data, expireAt: Date.now() + (ttl || CACHE_TTL) });
}

function clearCache(keyPrefix) {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}

// ==================== 负载均衡策略 ====================

const lbCounters = new Map();

function loadBalance(instances, strategy, clientKey) {
  if (!instances || instances.length === 0) return null;
  if (instances.length === 1) return instances[0];

  switch (strategy) {
    case 'random': {
      return instances[Math.floor(Math.random() * instances.length)];
    }

    case 'weighted': {
      // 加权随机
      const totalWeight = instances.reduce((sum, i) => sum + (i.weight || 1), 0);
      let random = Math.random() * totalWeight;
      for (const instance of instances) {
        random -= instance.weight || 1;
        if (random <= 0) return instance;
      }
      return instances[instances.length - 1];
    }

    case 'least-connections': {
      let minConn = Infinity;
      let selected = instances[0];
      for (const inst of instances) {
        const conn = inst.activeConnections || 0;
        if (conn < minConn) {
          minConn = conn;
          selected = inst;
        }
      }
      return selected;
    }

    case 'consistent-hash': {
      // 一致性哈希 (基于客户端 key)
      const hashKey = clientKey || 'default';
      const hash = crypto.createHash('md5').update(hashKey).digest('hex');
      const hashVal = parseInt(hash.substring(0, 8), 16);
      return instances[hashVal % instances.length];
    }

    case 'round-robin':
    default: {
      const serviceName = instances[0]?.serviceName || 'unknown';
      const idx = (lbCounters.get(serviceName) || 0) % instances.length;
      lbCounters.set(serviceName, idx + 1);
      return instances[idx];
    }
  }
}

// ==================== 服务发现核心 ====================

/**
 * 服务数据结构:
 * {
 *   serviceId: string,
 *   serviceName: string,
 *   namespace: string,
 *   version: string,
 *   tags: string[],
 *   metadata: object,
 *   endpoints: [{
 *     endpointId: string,
 *     host: string,
 *     port: number,
 *     protocol: string,
 *     weight: number,
 *     healthy: boolean,
 *     status: string,
 *     activeConnections: number,
 *     metadata: object,
 *     registeredAt: string,
 *     lastHealthCheck: string,
 *   }],
 *   routingRules: object,    // 版本路由规则
 * }
 */

function discoverService(serviceName, options = {}) {
  const { namespace, version, tags, metadata, healthyOnly, strategy, clientKey } = options;

  const cacheKey = `discover:${serviceName}:${namespace || ''}:${version || ''}:${JSON.stringify(tags || [])}:${healthyOnly}`;
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const services = loadServices();
  let matches = services.filter((s) => s.serviceName === serviceName);

  if (namespace) {
    matches = matches.filter((s) => s.namespace === namespace);
  }
  if (version) {
    matches = matches.filter((s) => s.version === version);
  }
  if (tags && tags.length > 0) {
    matches = matches.filter((s) => tags.every((t) => s.tags && s.tags.includes(t)));
  }
  if (metadata) {
    matches = matches.filter((s) => {
      if (!s.metadata) return false;
      return Object.entries(metadata).every(([k, v]) => s.metadata[k] === v);
    });
  }

  // 收集所有端点
  let endpoints = [];
  for (const service of matches) {
    for (const ep of service.endpoints) {
      endpoints.push({
        ...ep,
        serviceName: service.serviceName,
        serviceId: service.serviceId,
        namespace: service.namespace,
        version: service.version,
        serviceTags: service.tags,
        serviceMetadata: service.metadata,
      });
    }
  }

  if (healthyOnly !== false) {
    endpoints = endpoints.filter((ep) => ep.healthy && ep.status === 'up');
  }

  // 版本路由 (灰度发布规则)
  const routingRules = matches.length > 0 ? matches[0].routingRules : null;
  if (routingRules && routingRules.rules && routingRules.rules.length > 0) {
    for (const rule of routingRules.rules) {
      if (rule.type === 'canary' && rule.percentage) {
        const hash = clientKey
          ? parseInt(crypto.createHash('md5').update(clientKey).digest('hex').substring(0, 8), 16) %
            100
          : 0;
        if (hash < rule.percentage) {
          // 路由到灰度版本
          const canaryEndpoints = endpoints.filter((ep) => ep.version === rule.targetVersion);
          if (canaryEndpoints.length > 0) {
            endpoints = canaryEndpoints;
          }
        }
      }
      if (rule.type === 'header' && rule.headers && clientKey) {
        // 基于头信息的路由
        const matched = endpoints.filter((ep) => ep.version === rule.targetVersion);
        if (matched.length > 0) {
          endpoints = matched;
        }
      }
    }
  }

  const result = {
    serviceName,
    namespace: namespace || 'default',
    totalEndpoints: endpoints.length,
    healthyEndpoints: endpoints.filter((ep) => ep.healthy).length,
    endpoints,
  };

  setCache(cacheKey, result);
  return { ...result, fromCache: false };
}

function resolveService(dnsName) {
  // DNS 风格解析: serviceName.protocol.port
  // 例: user-service.http.3001
  const parts = dnsName.split('.');
  const serviceName = parts[0];
  const protocol = parts[1] || 'http';
  const port = parts[2] ? parseInt(parts[2]) : null;

  const result = discoverService(serviceName, { healthyOnly: true });

  let endpoints = result.endpoints;
  if (protocol) {
    endpoints = endpoints.filter((ep) => ep.protocol === protocol);
  }
  if (port) {
    endpoints = endpoints.filter((ep) => ep.port === port);
  }

  if (endpoints.length === 0) {
    return null;
  }

  // 轮询选择一个
  const selected = loadBalance(endpoints, 'round-robin', null);
  return {
    service: serviceName,
    protocol,
    host: selected.host,
    port: selected.port,
    address: `${selected.protocol}://${selected.host}:${selected.port}`,
    weight: selected.weight,
    version: selected.version,
    namespace: selected.namespace,
  };
}

// ==================== 订阅/通知系统 ====================

const activeSubscribers = new Map(); // subscriberId -> { res, services, lastEventTime }

function addSubscriber(subscriberId, services, res) {
  activeSubscribers.set(subscriberId, {
    id: subscriberId,
    services,
    res,
    createdAt: new Date().toISOString(),
    lastEventTime: Date.now(),
  });

  // 设置超时清理
  setTimeout(() => {
    if (activeSubscribers.has(subscriberId)) {
      try {
        const sub = activeSubscribers.get(subscriberId);
        sendJson(sub.res, 200, {
          success: true,
          data: { event: 'timeout', message: '订阅超时，请重新连接' },
        });
      } catch {}
      activeSubscribers.delete(subscriberId);
    }
  }, SUBSCRIBER_TIMEOUT);
}

function notifySubscribers(serviceName, event) {
  for (const [subId, sub] of activeSubscribers) {
    if (sub.services.includes(serviceName) || sub.services.includes('*')) {
      try {
        sendJson(sub.res, 200, {
          success: true,
          data: {
            event,
            serviceName,
            timestamp: new Date().toISOString(),
          },
        });
        activeSubscribers.delete(subId);
      } catch {
        activeSubscribers.delete(subId);
      }
    }
  }
}

// ==================== 健康探测 ====================

async function probeEndpoint(host, port, protocol) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port,
      path: '/health',
      method: 'GET',
      timeout: HEALTH_CHECK_TIMEOUT,
    };

    const probeReq = http.request(options, (probeRes) => {
      resolve({
        healthy: probeRes.statusCode === 200,
        statusCode: probeRes.statusCode,
      });
    });

    probeReq.on('error', () => resolve({ healthy: false, error: 'connection_failed' }));
    probeReq.on('timeout', () => {
      probeReq.destroy();
      resolve({ healthy: false, error: 'timeout' });
    });

    probeReq.end();
  });
}

async function runHealthProbes() {
  const services = loadServices();
  let changed = false;

  for (const service of services) {
    for (const ep of service.endpoints) {
      const result = await probeEndpoint(ep.host, ep.port, ep.protocol);
      const wasHealthy = ep.healthy;
      ep.healthy = result.healthy;
      ep.lastHealthCheck = new Date().toISOString();

      if (result.healthy) {
        ep.status = 'up';
      } else {
        ep.status = 'down';
      }

      if (wasHealthy !== ep.healthy) {
        changed = true;
        console.log(
          `  [健康探测] ${service.serviceName} ${ep.host}:${ep.port} → ${ep.healthy ? '健康' : '不可达'}`
        );
        notifySubscribers(service.serviceName, {
          type: ep.healthy ? 'endpoint_recovered' : 'endpoint_down',
          endpointId: ep.endpointId,
          host: ep.host,
          port: ep.port,
        });
      }
    }
  }

  if (changed) {
    saveServices(services);
    clearCache('discover:');
  }
}

// ==================== 路由处理 ====================

// --- 服务注册 ---

async function registerService(req, res) {
  const body = await parseBody(req);
  const {
    serviceName,
    namespace,
    version,
    tags,
    metadata,
    host,
    port,
    protocol,
    weight,
    endpointMetadata,
    routingRules,
  } = body;

  if (!serviceName) return sendError(res, 400, '服务名称不能为空');
  if (!host || !port) return sendError(res, 400, '端点地址 (host, port) 不能为空');

  const services = loadServices();
  const endpointId = generateId();
  const sid = `${serviceName}:${namespace || 'default'}:${version || '1.0.0'}`;

  let service = services.find((s) => s.serviceId === sid);

  const endpoint = {
    endpointId,
    host,
    port: parseInt(port),
    protocol: protocol || 'http',
    weight: weight || 1,
    healthy: true,
    status: 'up',
    activeConnections: 0,
    metadata: endpointMetadata || {},
    registeredAt: new Date().toISOString(),
    lastHealthCheck: new Date().toISOString(),
  };

  if (service) {
    // 检查是否已有相同端点
    const existing = service.endpoints.find(
      (e) => e.host === host && e.port === parseInt(port) && e.protocol === (protocol || 'http')
    );
    if (existing) {
      existing.healthy = true;
      existing.status = 'up';
      existing.lastHealthCheck = new Date().toISOString();
      saveServices(services);
      clearCache('discover:');
      return sendSuccess(res, {
        serviceId: sid,
        endpointId: existing.endpointId,
        action: 'updated',
      });
    }

    service.endpoints.push(endpoint);
    if (routingRules) service.routingRules = routingRules;
  } else {
    service = {
      serviceId: sid,
      serviceName,
      namespace: namespace || 'default',
      version: version || '1.0.0',
      tags: tags || [],
      metadata: metadata || {},
      endpoints: [endpoint],
      routingRules: routingRules || { rules: [] },
      createdAt: new Date().toISOString(),
    };
    services.push(service);
  }

  saveServices(services);
  clearCache('discover:');
  notifySubscribers(serviceName, {
    type: 'endpoint_registered',
    endpointId,
    host,
    port,
  });

  sendJson(res, 201, {
    success: true,
    data: { serviceId: sid, endpointId, action: 'registered' },
  });
}

// --- 服务注销 ---

async function deregisterService(req, res) {
  const body = await parseBody(req);
  const { serviceId, endpointId, host, port } = body;

  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, '服务不存在');

  let removedEndpoint;
  if (endpointId) {
    const idx = service.endpoints.findIndex((e) => e.endpointId === endpointId);
    if (idx === -1) return sendError(res, 404, '端点不存在');
    removedEndpoint = service.endpoints[idx];
    service.endpoints.splice(idx, 1);
  } else if (host && port) {
    const idx = service.endpoints.findIndex((e) => e.host === host && e.port === parseInt(port));
    if (idx === -1) return sendError(res, 404, '端点不存在');
    removedEndpoint = service.endpoints[idx];
    service.endpoints.splice(idx, 1);
  } else {
    return sendError(res, 400, '需要 endpointId 或 (host, port)');
  }

  // 没有端点了就删除服务
  if (service.endpoints.length === 0) {
    const sidx = services.findIndex((s) => s.serviceId === serviceId);
    services.splice(sidx, 1);
  }

  saveServices(services);
  clearCache('discover:');
  notifySubscribers(service.serviceName, {
    type: 'endpoint_deregistered',
    endpointId: removedEndpoint.endpointId,
    host: removedEndpoint.host,
    port: removedEndpoint.port,
  });

  sendSuccess(res, { action: 'deregistered' });
}

// --- 服务发现 ---

function discoverEndpoint(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const serviceName = parsedUrl.query.name;
  const namespace = parsedUrl.query.namespace;
  const version = parsedUrl.query.version;
  const tags = parsedUrl.query.tags ? parsedUrl.query.tags.split(',') : null;
  const strategy = parsedUrl.query.strategy || 'round-robin';
  const clientKey = parsedUrl.query.clientKey;
  const healthyOnly = parsedUrl.query.healthy !== 'false';

  if (!serviceName) return sendError(res, 400, '缺少服务名称 (name 参数)');

  const result = discoverService(serviceName, {
    namespace,
    version,
    tags,
    healthyOnly,
    strategy,
    clientKey,
  });

  if (result.endpoints.length === 0) {
    return sendError(res, 404, `未发现服务: ${serviceName}`);
  }

  // 选择一个端点
  const selected = loadBalance(result.endpoints, strategy, clientKey);

  sendSuccess(res, {
    service: serviceName,
    selected: {
      host: selected.host,
      port: selected.port,
      protocol: selected.protocol,
      address: `${selected.protocol}://${selected.host}:${selected.port}`,
      weight: selected.weight,
      version: selected.version,
      namespace: selected.namespace,
    },
    availableEndpoints: result.totalEndpoints,
    healthyEndpoints: result.healthyEndpoints,
    fromCache: result.fromCache,
  });
}

// --- DNS 风格解析 ---

function resolveDns(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const dnsName = parsedUrl.query.name;

  if (!dnsName) return sendError(res, 400, '缺少 DNS 名称 (name 参数)');

  const result = resolveService(dnsName);
  if (!result) {
    return sendError(res, 404, `无法解析: ${dnsName}`);
  }

  sendSuccess(res, result);
}

// --- 查询所有服务 ---

function listServices(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { namespace, tag } = parsedUrl.query;

  const cacheKey = `list:${namespace || ''}:${tag || ''}`;
  const cached = getCache(cacheKey);
  if (cached) return sendSuccess(res, { ...cached, fromCache: true });

  let services = loadServices();
  if (namespace) services = services.filter((s) => s.namespace === namespace);
  if (tag) services = services.filter((s) => s.tags && s.tags.includes(tag));

  const result = services.map((s) => ({
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    namespace: s.namespace,
    version: s.version,
    tags: s.tags,
    metadata: s.metadata,
    endpointCount: s.endpoints.length,
    healthyCount: s.endpoints.filter((e) => e.healthy).length,
    createdAt: s.createdAt,
  }));

  setCache(cacheKey, result);
  sendSuccess(res, { services: result, fromCache: false });
}

// --- 查询服务详情 ---

function getServiceDetail(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === decodeURIComponent(serviceId));
  if (!service) return sendError(res, 404, '服务不存在');
  sendSuccess(res, service);
}

// --- 批量发现 ---

async function batchDiscover(req, res) {
  const body = await parseBody(req);
  const { services: serviceNames, strategy, clientKey } = body;

  if (!Array.isArray(serviceNames)) return sendError(res, 400, 'services 必须是数组');

  const results = {};
  for (const name of serviceNames) {
    const result = discoverService(name, {
      healthyOnly: true,
      strategy: strategy || 'round-robin',
      clientKey,
    });
    if (result.endpoints.length > 0) {
      const selected = loadBalance(result.endpoints, strategy || 'round-robin', clientKey);
      results[name] = {
        host: selected.host,
        port: selected.port,
        protocol: selected.protocol,
        address: `${selected.protocol}://${selected.host}:${selected.port}`,
        version: selected.version,
      };
    } else {
      results[name] = null;
    }
  }

  sendSuccess(res, results);
}

// --- 服务订阅 ---

function subscribeService(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const services = parsedUrl.query.services ? parsedUrl.query.services.split(',') : ['*'];
  const subscriberId = generateId();

  addSubscriber(subscriberId, services, res);
}

// --- 命名空间管理 ---

function listNamespaces(req, res) {
  const namespaces = loadNamespaces();
  const services = loadServices();

  const result = namespaces.map((ns) => ({
    ...ns,
    serviceCount: services.filter((s) => s.namespace === ns.name).length,
  }));

  sendSuccess(res, result);
}

async function createNamespace(req, res) {
  const body = await parseBody(req);
  const { name, description } = body;

  if (!name) return sendError(res, 400, '命名空间名称不能为空');

  const namespaces = loadNamespaces();
  if (namespaces.find((ns) => ns.name === name)) return sendError(res, 409, '命名空间已存在');

  const ns = {
    name,
    description: description || '',
    createdAt: new Date().toISOString(),
  };

  namespaces.push(ns);
  saveNamespaces(namespaces);
  sendJson(res, 201, { success: true, data: ns });
}

// --- 版本路由规则 ---

async function updateRoutingRules(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === decodeURIComponent(serviceId));
  if (!service) return sendError(res, 404, '服务不存在');

  const body = await parseBody(req);
  service.routingRules = body.routingRules || { rules: [] };

  saveServices(services);
  clearCache('discover:');
  sendSuccess(res, service.routingRules);
}

// --- 服务依赖分析 ---

function analyzeDependencies(req, res) {
  const services = loadServices();
  const depGraph = {};

  for (const service of services) {
    const deps = service.metadata?.dependencies || [];
    depGraph[service.serviceName] = {
      serviceId: service.serviceId,
      namespace: service.namespace,
      version: service.version,
      dependencies: deps,
      dependents: services
        .filter((s) => (s.metadata?.dependencies || []).includes(service.serviceName))
        .map((s) => ({
          serviceName: s.serviceName,
          namespace: s.namespace,
          version: s.version,
        })),
    };
  }

  sendSuccess(res, depGraph);
}

// --- 缓存管理 ---

function getCacheStats(req, res) {
  const stats = {
    totalKeys: cache.size,
    keys: [...cache.keys()].map((k) => {
      const entry = cache.get(k);
      return { key: k, expireAt: new Date(entry.expireAt).toISOString() };
    }),
  };
  sendSuccess(res, stats);
}

function clearAllCache(req, res) {
  clearCache();
  sendSuccess(res, { message: '缓存已清除' });
}

// --- 统计信息 ---

function getStats(req, res) {
  const services = loadServices();
  const namespaces = loadNamespaces();

  const totalEndpoints = services.reduce((sum, s) => sum + s.endpoints.length, 0);
  const healthyEndpoints = services.reduce(
    (sum, s) => sum + s.endpoints.filter((e) => e.healthy).length,
    0
  );

  sendSuccess(res, {
    totalServices: services.length,
    totalEndpoints,
    healthyEndpoints,
    unhealthyEndpoints: totalEndpoints - healthyEndpoints,
    namespaces: namespaces.length,
    cacheSize: cache.size,
    activeSubscribers: activeSubscribers.size,
    supportedStrategies: [
      'round-robin',
      'random',
      'weighted',
      'least-connections',
      'consistent-hash',
    ],
  });
}

// --- 健康检查 ---

function healthCheck(req, res) {
  sendSuccess(res, {
    service: '服务发现系统',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// ==================== 请求路由 ====================

async function handleRequest(req, res) {
  // CORS
  if (handleCors(req, res)) return;
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const method = req.method;
  const segments = parsePath(req.url);

  try {
    // 健康检查
    if (segments.length === 1 && segments[0] === 'health' && method === 'GET') {
      return healthCheck(req, res);
    }

    // 服务注册
    if (segments[0] === 'api' && segments[1] === 'register' && method === 'POST') {
      return await registerService(req, res);
    }

    // 服务注销
    if (segments[0] === 'api' && segments[1] === 'deregister' && method === 'POST') {
      return await deregisterService(req, res);
    }

    // 服务发现
    if (segments[0] === 'api' && segments[1] === 'discover' && method === 'GET') {
      return discoverEndpoint(req, res);
    }

    // DNS 解析
    if (segments[0] === 'api' && segments[1] === 'resolve' && method === 'GET') {
      return resolveDns(req, res);
    }

    // 批量发现
    if (
      segments[0] === 'api' &&
      segments[1] === 'discover' &&
      segments[2] === 'batch' &&
      method === 'POST'
    ) {
      return await batchDiscover(req, res);
    }

    // 服务列表
    if (segments[0] === 'api' && segments[1] === 'services' && !segments[2] && method === 'GET') {
      return listServices(req, res);
    }

    // 服务详情
    if (
      segments[0] === 'api' &&
      segments[1] === 'services' &&
      segments[2] &&
      !segments[3] &&
      method === 'GET'
    ) {
      return getServiceDetail(req, res, segments[2]);
    }

    // 版本路由规则
    if (
      segments[0] === 'api' &&
      segments[1] === 'services' &&
      segments[2] &&
      segments[3] === 'routing' &&
      method === 'PUT'
    ) {
      return await updateRoutingRules(req, res, segments[2]);
    }

    // 服务订阅
    if (segments[0] === 'api' && segments[1] === 'subscribe' && method === 'GET') {
      return subscribeService(req, res);
    }

    // 命名空间管理
    if (segments[0] === 'api' && segments[1] === 'namespaces') {
      if (method === 'GET') return listNamespaces(req, res);
      if (method === 'POST') return await createNamespace(req, res);
    }

    // 依赖分析
    if (segments[0] === 'api' && segments[1] === 'dependencies' && method === 'GET') {
      return analyzeDependencies(req, res);
    }

    // 缓存管理
    if (segments[0] === 'api' && segments[1] === 'cache') {
      if (segments[2] === 'stats' && method === 'GET') return getCacheStats(req, res);
      if (method === 'DELETE') return clearAllCache(req, res);
    }

    // 统计信息
    if (segments[0] === 'api' && segments[1] === 'stats' && method === 'GET') {
      return getStats(req, res);
    }

    sendError(res, 404, '接口不存在');
  } catch (err) {
    console.error('请求处理错误:', err);
    sendError(res, 500, '服务器内部错误');
  }
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  const services = loadServices();
  if (services.length === 0) {
    const defaultServices = [
      {
        serviceId: 'user-service:default:1.0.0',
        serviceName: 'user-service',
        namespace: 'default',
        version: '1.0.0',
        tags: ['core', 'user'],
        metadata: { language: 'node.js', team: 'platform' },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.1.10',
            port: 3001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 12,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.1.11',
            port: 3001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 8,
            metadata: { zone: 'b' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.1.12',
            port: 3001,
            protocol: 'grpc',
            weight: 2,
            healthy: true,
            status: 'up',
            activeConnections: 15,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: {
          rules: [
            {
              type: 'canary',
              targetVersion: '2.0.0',
              percentage: 10,
              description: '10% 流量路由到 v2.0.0',
            },
          ],
        },
        createdAt: new Date().toISOString(),
      },
      {
        serviceId: 'user-service:default:2.0.0',
        serviceName: 'user-service',
        namespace: 'default',
        version: '2.0.0',
        tags: ['core', 'user', 'canary'],
        metadata: { language: 'node.js', team: 'platform', canary: true },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.2.10',
            port: 3001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 2,
            metadata: { zone: 'a', canary: true },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: { rules: [] },
        createdAt: new Date().toISOString(),
      },
      {
        serviceId: 'order-service:default:1.0.0',
        serviceName: 'order-service',
        namespace: 'default',
        version: '1.0.0',
        tags: ['business', 'order'],
        metadata: {
          language: 'node.js',
          team: 'commerce',
          dependencies: ['user-service', 'product-service', 'payment-service'],
        },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.3.10',
            port: 4001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 25,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.3.11',
            port: 4001,
            protocol: 'http',
            weight: 2,
            healthy: true,
            status: 'up',
            activeConnections: 18,
            metadata: { zone: 'b' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: { rules: [] },
        createdAt: new Date().toISOString(),
      },
      {
        serviceId: 'product-service:default:1.0.0',
        serviceName: 'product-service',
        namespace: 'default',
        version: '1.0.0',
        tags: ['business', 'product'],
        metadata: { language: 'node.js', team: 'commerce' },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.4.10',
            port: 5001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 30,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.4.11',
            port: 5001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 22,
            metadata: { zone: 'b' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.4.12',
            port: 5001,
            protocol: 'http',
            weight: 1,
            healthy: false,
            status: 'down',
            activeConnections: 0,
            metadata: { zone: 'c' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: { rules: [] },
        createdAt: new Date().toISOString(),
      },
      {
        serviceId: 'payment-service:production:1.0.0',
        serviceName: 'payment-service',
        namespace: 'production',
        version: '1.0.0',
        tags: ['business', 'payment', 'critical'],
        metadata: {
          language: 'java',
          team: 'finance',
          dependencies: ['auth-service'],
        },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.5.10',
            port: 7001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 5,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: { rules: [] },
        createdAt: new Date().toISOString(),
      },
      {
        serviceId: 'auth-service:default:1.0.0',
        serviceName: 'auth-service',
        namespace: 'default',
        version: '1.0.0',
        tags: ['core', 'auth'],
        metadata: { language: 'node.js', team: 'platform' },
        endpoints: [
          {
            endpointId: generateId(),
            host: '10.0.6.10',
            port: 6001,
            protocol: 'http',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 40,
            metadata: { zone: 'a' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
          {
            endpointId: generateId(),
            host: '10.0.6.11',
            port: 6001,
            protocol: 'grpc',
            weight: 1,
            healthy: true,
            status: 'up',
            activeConnections: 35,
            metadata: { zone: 'b' },
            registeredAt: new Date().toISOString(),
            lastHealthCheck: new Date().toISOString(),
          },
        ],
        routingRules: { rules: [] },
        createdAt: new Date().toISOString(),
      },
    ];

    saveServices(defaultServices);
  }

  const namespaces = loadNamespaces();
  if (namespaces.length === 0) {
    saveNamespaces([
      {
        name: 'default',
        description: '默认命名空间',
        createdAt: new Date().toISOString(),
      },
      {
        name: 'production',
        description: '生产环境命名空间',
        createdAt: new Date().toISOString(),
      },
      {
        name: 'staging',
        description: '预发布命名空间',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

// ==================== 启动服务器 ====================

initDefaultData();

const server = http.createServer(handleRequest);

// 定时健康探测
const healthProbeTimer = setInterval(runHealthProbes, HEALTH_CHECK_INTERVAL);

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║          服务发现系统已启动                   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log('');
  console.log('  服务注册与发现:');
  console.log('  ├─ POST   /api/register                注册服务端点');
  console.log('  ├─ POST   /api/deregister              注销服务端点');
  console.log('  ├─ GET    /api/discover?name=xxx        发现服务 (返回单个端点)');
  console.log('  ├─ POST   /api/discover/batch          批量发现');
  console.log('  └─ GET    /api/resolve?name=xxx         DNS 风格解析');
  console.log('');
  console.log('  服务查询:');
  console.log('  ├─ GET    /api/services                 服务列表');
  console.log('  ├─ GET    /api/services/:id             服务详情');
  console.log('  └─ PUT    /api/services/:id/routing     更新路由规则');
  console.log('');
  console.log('  订阅与通知:');
  console.log('  └─ GET    /api/subscribe?services=xxx   订阅服务变更');
  console.log('');
  console.log('  命名空间:');
  console.log('  ├─ GET    /api/namespaces               命名空间列表');
  console.log('  └─ POST   /api/namespaces               创建命名空间');
  console.log('');
  console.log('  分析与管理:');
  console.log('  ├─ GET    /api/dependencies             依赖分析');
  console.log('  ├─ GET    /api/cache/stats              缓存统计');
  console.log('  ├─ DELETE /api/cache                    清除缓存');
  console.log('  └─ GET    /api/stats                    系统统计');
  console.log('');
  console.log('  负载均衡策略:');
  console.log('  ├─ round-robin       轮询 (默认)');
  console.log('  ├─ random            随机');
  console.log('  ├─ weighted          加权随机');
  console.log('  ├─ least-connections 最少连接');
  console.log('  └─ consistent-hash  一致性哈希');
  console.log('');
  console.log('  默认服务:');
  console.log('  ├─ user-service     v1.0.0 (3 端点) + v2.0.0 (1 端点, 灰度10%)');
  console.log('  ├─ order-service    v1.0.0 (2 端点)');
  console.log('  ├─ product-service  v1.0.0 (3 端点, 1 个不健康)');
  console.log('  ├─ payment-service  v1.0.0 (1 端点, production 命名空间)');
  console.log('  └─ auth-service     v1.0.0 (2 端点, http+grpc)');
  console.log('');
  console.log('  DNS 解析格式: serviceName.protocol.port');
  console.log('  例: user-service.http.3001');
  console.log('');
  console.log('  健康检查: http://localhost:' + PORT + '/health');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务发现系统...');
  clearInterval(healthProbeTimer);
  // 关闭所有订阅者连接
  for (const [subId, sub] of activeSubscribers) {
    try {
      sendJson(sub.res, 200, { success: false, error: '服务关闭' });
    } catch {}
  }
  activeSubscribers.clear();
  server.close(() => {
    console.log('服务发现系统已关闭');
    process.exit(0);
  });
});
