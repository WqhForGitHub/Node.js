/**
 * 微服务注册中心 - 纯 Node.js 实现
 *
 * 功能:
 *   - 服务注册 / 注销
 *   - 心跳检测 (自动摘除不健康实例)
 *   - 服务实例查询
 *   - 服务分组 / 版本管理
 *   - 服务元数据管理
 *   - 服务标签 (Tags)
 *   - 服务依赖关系
 *   - 服务健康状态监控
 *   - 变更事件通知 (长轮询)
 *   - 集群信息
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ==================== 配置 ====================

const PORT = 3900;
const DATA_DIR = path.join(__dirname, "data");
const HEARTBEAT_TIMEOUT = 15000; // 心跳超时: 15秒
const HEARTBEAT_CHECK_INTERVAL = 5000; // 心跳检查间隔: 5秒
const DEREGISTER_AFTER_TIMEOUT = true; // 超时后自动注销

// ==================== 数据层 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf-8");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

const servicesFile = path.join(DATA_DIR, "services.json");
const eventsFile = path.join(DATA_DIR, "events.json");
const clustersFile = path.join(DATA_DIR, "clusters.json");

function loadServices() {
  return readJson(servicesFile);
}
function saveServices(data) {
  writeJson(servicesFile, data);
}
function loadEvents() {
  return readJson(eventsFile);
}
function saveEvents(data) {
  writeJson(eventsFile, data);
}
function loadClusters() {
  return readJson(clustersFile);
}
function saveClusters(data) {
  writeJson(clustersFile, data);
}

// ==================== 工具函数 ====================

function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("无效的 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
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
  return parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
}

// ==================== CORS 处理 ====================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function handleCors(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }
  return false;
}

// ==================== 事件系统 ====================

function addEvent(type, serviceId, instanceId, data) {
  const events = loadEvents();
  const event = {
    id: generateId(),
    type,
    serviceId,
    instanceId,
    data,
    timestamp: new Date().toISOString(),
  };
  events.push(event);
  // 只保留最近 500 条事件
  if (events.length > 500) events.splice(0, events.length - 500);
  saveEvents(events);

  // 通知等待的长轮询客户端
  notifyWatchers(event);
  return event;
}

// ==================== 长轮询通知 ====================

const watchers = [];

function addWatcher(res, lastEventId, timeout) {
  return new Promise((resolve) => {
    const watcher = { res, lastEventId, resolved: false };
    watchers.push(watcher);

    // 先检查是否有新事件
    const events = loadEvents();
    const newEvents = lastEventId
      ? events.filter((e) => e.id > lastEventId)
      : events.slice(-20);

    if (newEvents.length > 0) {
      watcher.resolved = true;
      const idx = watchers.indexOf(watcher);
      if (idx > -1) watchers.splice(idx, 1);
      resolve(newEvents);
      return;
    }

    // 设置超时
    setTimeout(() => {
      if (!watcher.resolved) {
        watcher.resolved = true;
        const idx = watchers.indexOf(watcher);
        if (idx > -1) watchers.splice(idx, 1);
        resolve([]);
      }
    }, timeout || 30000);
  });
}

function notifyWatchers(event) {
  for (const watcher of watchers) {
    if (!watcher.resolved) {
      watcher.resolved = true;
      sendSuccess(watcher.res, [event]);
    }
  }
  watchers.length = 0;
}

// ==================== 服务注册核心 ====================

/**
 * 服务数据结构:
 * {
 *   serviceId: string,       // 服务唯一标识
 *   serviceName: string,     // 服务名称
 *   group: string,           // 服务分组
 *   version: string,         // 服务版本
 *   description: string,     // 服务描述
 *   tags: string[],          // 服务标签
 *   metadata: object,        // 服务元数据
 *   dependencies: string[],  // 依赖的服务列表
 *   instances: [{
 *     instanceId: string,
 *     host: string,
 *     port: number,
 *     protocol: string,
 *     weight: number,
 *     healthy: boolean,
 *     status: string,        // up / down / starting
 *     metadata: object,
 *     registeredAt: string,
 *     lastHeartbeat: string,
 *   }]
 * }
 */

function registerService(reqBody) {
  const {
    serviceName,
    serviceId,
    group,
    version,
    description,
    tags,
    metadata,
    dependencies,
    host,
    port,
    protocol,
    weight,
    instanceMetadata,
  } = reqBody;

  if (!serviceName) return { error: "服务名称不能为空" };
  if (!host || !port) return { error: "实例地址 (host, port) 不能为空" };

  const services = loadServices();
  const instanceId = generateId();
  const sid = serviceId || `${serviceName}:${version || "default"}`;

  let service = services.find((s) => s.serviceId === sid);

  if (service) {
    // 检查是否已有相同地址的实例
    const existing = service.instances.find(
      (i) => i.host === host && i.port === parseInt(port),
    );
    if (existing) {
      // 更新心跳
      existing.lastHeartbeat = new Date().toISOString();
      existing.healthy = true;
      existing.status = "up";
      saveServices(services);
      addEvent("heartbeat", sid, existing.instanceId, { host, port });
      return {
        serviceId: sid,
        instanceId: existing.instanceId,
        action: "heartbeat",
      };
    }

    // 添加新实例
    const instance = {
      instanceId,
      host,
      port: parseInt(port),
      protocol: protocol || "http",
      weight: weight || 1,
      healthy: true,
      status: "up",
      metadata: instanceMetadata || {},
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };
    service.instances.push(instance);
    saveServices(services);
    addEvent("instance_registered", sid, instanceId, { host, port });
    return { serviceId: sid, instanceId, action: "registered" };
  }

  // 创建新服务
  service = {
    serviceId: sid,
    serviceName,
    group: group || "default",
    version: version || "1.0.0",
    description: description || "",
    tags: tags || [],
    metadata: metadata || {},
    dependencies: dependencies || [],
    createdAt: new Date().toISOString(),
    instances: [
      {
        instanceId,
        host,
        port: parseInt(port),
        protocol: protocol || "http",
        weight: weight || 1,
        healthy: true,
        status: "up",
        metadata: instanceMetadata || {},
        registeredAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
      },
    ],
  };

  services.push(service);
  saveServices(services);
  addEvent("service_registered", sid, instanceId, { serviceName, host, port });
  return { serviceId: sid, instanceId, action: "registered" };
}

function deregisterInstance(serviceId, instanceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return { error: "服务不存在" };

  const idx = service.instances.findIndex((i) => i.instanceId === instanceId);
  if (idx === -1) return { error: "实例不存在" };

  const removed = service.instances[idx];
  service.instances.splice(idx, 1);

  // 如果没有实例了，删除整个服务
  if (service.instances.length === 0) {
    const sidx = services.findIndex((s) => s.serviceId === serviceId);
    services.splice(sidx, 1);
    addEvent("service_deregistered", serviceId, null, {
      serviceName: service.serviceName,
    });
  } else {
    addEvent("instance_deregistered", serviceId, instanceId, {
      host: removed.host,
      port: removed.port,
    });
  }

  saveServices(services);
  return { success: true, action: "deregistered" };
}

function heartbeat(serviceId, instanceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return { error: "服务不存在" };

  const instance = service.instances.find((i) => i.instanceId === instanceId);
  if (!instance) return { error: "实例不存在" };

  instance.lastHeartbeat = new Date().toISOString();
  instance.healthy = true;
  instance.status = "up";
  saveServices(services);
  addEvent("heartbeat", serviceId, instanceId, {
    host: instance.host,
    port: instance.port,
  });
  return { success: true };
}

// ==================== 心跳检查 ====================

function checkHeartbeats() {
  const services = loadServices();
  const now = Date.now();
  let changed = false;

  for (const service of services) {
    for (const instance of service.instances) {
      const lastBeat = new Date(instance.lastHeartbeat).getTime();
      if (now - lastBeat > HEARTBEAT_TIMEOUT) {
        if (instance.healthy) {
          instance.healthy = false;
          instance.status = "down";
          changed = true;
          console.log(
            `  [心跳超时] ${service.serviceName} ${instance.host}:${instance.port}`,
          );
          addEvent(
            "instance_unhealthy",
            service.serviceId,
            instance.instanceId,
            {
              host: instance.host,
              port: instance.port,
              reason: "heartbeat_timeout",
            },
          );
        }

        // 可选: 超时后自动注销
        if (
          DEREGISTER_AFTER_TIMEOUT &&
          now - lastBeat > HEARTBEAT_TIMEOUT * 3
        ) {
          console.log(
            `  [自动注销] ${service.serviceName} ${instance.host}:${instance.port}`,
          );
          addEvent(
            "instance_auto_deregistered",
            service.serviceId,
            instance.instanceId,
            {
              host: instance.host,
              port: instance.port,
              reason: "heartbeat_timeout_exceeded",
            },
          );
        }
      }
    }
  }

  // 清理超时自动注销的实例
  for (let si = services.length - 1; si >= 0; si--) {
    const service = services[si];
    for (let ii = service.instances.length - 1; ii >= 0; ii--) {
      const instance = service.instances[ii];
      const lastBeat = new Date(instance.lastHeartbeat).getTime();
      if (
        DEREGISTER_AFTER_TIMEOUT &&
        now - lastBeat > HEARTBEAT_TIMEOUT * 3 &&
        !instance.healthy
      ) {
        service.instances.splice(ii, 1);
      }
    }
    if (service.instances.length === 0) {
      services.splice(si, 1);
    }
  }

  if (changed || services !== loadServices()) {
    saveServices(services);
  }
}

// ==================== 路由处理 ====================

// --- 服务注册 ---

async function handleRegister(req, res) {
  const body = await parseBody(req);
  const result = registerService(body);
  if (result.error) return sendError(res, 400, result.error);
  sendJson(res, 201, { success: true, data: result });
}

// --- 服务注销 ---

function handleDeregister(req, res, serviceId, instanceId) {
  const result = deregisterInstance(serviceId, instanceId);
  if (result.error) return sendError(res, 404, result.error);
  sendSuccess(res, result);
}

// --- 心跳 ---

function handleHeartbeat(req, res, serviceId, instanceId) {
  const result = heartbeat(serviceId, instanceId);
  if (result.error) return sendError(res, 404, result.error);
  sendSuccess(res, result);
}

// --- 查询服务列表 ---

function listServices(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { group, tag, status } = parsedUrl.query;

  let services = loadServices();

  if (group) {
    services = services.filter((s) => s.group === group);
  }
  if (tag) {
    services = services.filter((s) => s.tags && s.tags.includes(tag));
  }
  if (status) {
    services = services.filter((s) =>
      s.instances.some((i) => i.status === status),
    );
  }

  const result = services.map((s) => ({
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    group: s.group,
    version: s.version,
    description: s.description,
    tags: s.tags,
    metadata: s.metadata,
    dependencies: s.dependencies,
    instanceCount: s.instances.length,
    healthyCount: s.instances.filter((i) => i.healthy).length,
    createdAt: s.createdAt,
  }));

  sendSuccess(res, result);
}

// --- 查询服务详情 ---

function getService(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, "服务不存在");
  sendSuccess(res, service);
}

// --- 查询服务实例 ---

function getInstances(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, "服务不存在");

  const parsedUrl = url.parse(req.url, true);
  const healthy = parsedUrl.query.healthy;

  let instances = service.instances;
  if (healthy === "true") {
    instances = instances.filter((i) => i.healthy);
  } else if (healthy === "false") {
    instances = instances.filter((i) => !i.healthy);
  }

  sendSuccess(res, instances);
}

// --- 更新服务元数据 ---

async function updateServiceMetadata(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, "服务不存在");

  const body = await parseBody(req);
  if (body.tags) service.tags = body.tags;
  if (body.metadata)
    service.metadata = { ...service.metadata, ...body.metadata };
  if (body.description !== undefined) service.description = body.description;
  if (body.dependencies) service.dependencies = body.dependencies;
  if (body.group) service.group = body.group;

  saveServices(services);
  addEvent("service_updated", serviceId, null, body);
  sendSuccess(res, service);
}

// --- 更新实例状态 ---

async function updateInstanceStatus(req, res, serviceId, instanceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, "服务不存在");

  const instance = service.instances.find((i) => i.instanceId === instanceId);
  if (!instance) return sendError(res, 404, "实例不存在");

  const body = await parseBody(req);
  if (body.status) instance.status = body.status;
  if (body.weight !== undefined) instance.weight = body.weight;
  if (body.metadata)
    instance.metadata = { ...instance.metadata, ...body.metadata };

  if (instance.status === "up") {
    instance.healthy = true;
  } else if (instance.status === "down") {
    instance.healthy = false;
  }

  saveServices(services);
  addEvent("instance_updated", serviceId, instanceId, body);
  sendSuccess(res, instance);
}

// --- 服务依赖关系 ---

function getServiceDependencies(req, res, serviceId) {
  const services = loadServices();
  const service = services.find((s) => s.serviceId === serviceId);
  if (!service) return sendError(res, 404, "服务不存在");

  const depServices = service.dependencies.map((depId) => {
    const dep = services.find(
      (s) => s.serviceId === depId || s.serviceName === depId,
    );
    return dep
      ? {
          serviceId: dep.serviceId,
          serviceName: dep.serviceName,
          available: true,
          healthyCount: dep.instances.filter((i) => i.healthy).length,
        }
      : {
          serviceId: depId,
          serviceName: depId,
          available: false,
          healthyCount: 0,
        };
  });

  // 查询谁依赖此服务
  const dependents = services
    .filter(
      (s) =>
        (s.dependencies && s.dependencies.includes(serviceId)) ||
        s.dependencies.includes(service.serviceName),
    )
    .map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName }));

  sendSuccess(res, { dependencies: depServices, dependents });
}

// --- 服务拓扑 ---

function getServiceTopology(req, res) {
  const services = loadServices();
  const nodes = services.map((s) => ({
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    group: s.group,
    version: s.version,
    instanceCount: s.instances.length,
    healthyCount: s.instances.filter((i) => i.healthy).length,
  }));

  const edges = [];
  for (const service of services) {
    for (const dep of service.dependencies) {
      const target = services.find(
        (s) => s.serviceId === dep || s.serviceName === dep,
      );
      if (target) {
        edges.push({
          source: service.serviceId,
          target: target.serviceId,
        });
      }
    }
  }

  sendSuccess(res, { nodes, edges });
}

// --- 事件查询 ---

function getEvents(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { serviceId, type, limit } = parsedUrl.query;

  let events = loadEvents();
  if (serviceId) events = events.filter((e) => e.serviceId === serviceId);
  if (type) events = events.filter((e) => e.type === type);

  const n = Math.min(parseInt(limit) || 50, 200);
  const result = events.slice(-n).reverse();
  sendSuccess(res, result);
}

// --- 长轮询监听 ---

async function watchEvents(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const lastEventId = parsedUrl.query.lastEventId || null;
  const timeout = parseInt(parsedUrl.query.timeout) || 30000;

  const events = await addWatcher(res, lastEventId, timeout);
  if (events.length > 0) {
    sendSuccess(res, events);
  }
}

// --- 集群管理 ---

function listClusters(req, res) {
  const clusters = loadClusters();
  const services = loadServices();

  const result = clusters.map((c) => ({
    ...c,
    serviceCount: services.filter((s) => s.group === c.name).length,
  }));

  sendSuccess(res, result);
}

async function createCluster(req, res) {
  const body = await parseBody(req);
  const { name, description } = body;

  if (!name) return sendError(res, 400, "集群名称不能为空");

  const clusters = loadClusters();
  if (clusters.find((c) => c.name === name))
    return sendError(res, 409, "集群已存在");

  const cluster = {
    name,
    description: description || "",
    createdAt: new Date().toISOString(),
  };

  clusters.push(cluster);
  saveClusters(clusters);
  sendJson(res, 201, { success: true, data: cluster });
}

// --- 健康检查 ---

function healthCheck(req, res) {
  const services = loadServices();
  const totalInstances = services.reduce(
    (sum, s) => sum + s.instances.length,
    0,
  );
  const healthyInstances = services.reduce(
    (sum, s) => sum + s.instances.filter((i) => i.healthy).length,
    0,
  );

  sendSuccess(res, {
    service: "微服务注册中心",
    status: "healthy",
    uptime: process.uptime(),
    totalServices: services.length,
    totalInstances,
    healthyInstances,
    unhealthyInstances: totalInstances - healthyInstances,
    timestamp: new Date().toISOString(),
  });
}

// --- 统计信息 ---

function getStats(req, res) {
  const services = loadServices();
  const events = loadEvents();
  const clusters = loadClusters();

  const totalInstances = services.reduce(
    (sum, s) => sum + s.instances.length,
    0,
  );
  const healthyInstances = services.reduce(
    (sum, s) => sum + s.instances.filter((i) => i.healthy).length,
    0,
  );
  const groups = [...new Set(services.map((s) => s.group))];
  const versions = [...new Set(services.map((s) => s.version))];

  sendSuccess(res, {
    totalServices: services.length,
    totalInstances,
    healthyInstances,
    unhealthyInstances: totalInstances - healthyInstances,
    groups: groups.length,
    versions,
    clusters: clusters.length,
    recentEvents: events.length,
    watcherCount: watchers.length,
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
    if (segments.length === 1 && segments[0] === "health" && method === "GET") {
      return healthCheck(req, res);
    }

    // 服务注册
    if (
      segments[0] === "api" &&
      segments[1] === "services" &&
      segments[2] === "register" &&
      method === "POST"
    ) {
      return await handleRegister(req, res);
    }

    // 服务注销
    if (
      segments[0] === "api" &&
      segments[1] === "services" &&
      segments[2] === "deregister" &&
      method === "POST"
    ) {
      return await handleDeregisterViaBody(req, res);
    }

    // 服务列表
    if (
      segments[0] === "api" &&
      segments[1] === "services" &&
      !segments[2] &&
      method === "GET"
    ) {
      return listServices(req, res);
    }

    // 服务详情 / 实例 / 元数据 / 依赖
    if (segments[0] === "api" && segments[1] === "services" && segments[2]) {
      const serviceId = decodeURIComponent(segments[2]);

      if (!segments[3] && method === "GET")
        return getService(req, res, serviceId);

      // 实例列表
      if (segments[3] === "instances" && !segments[4] && method === "GET") {
        return getInstances(req, res, serviceId);
      }

      // 实例操作
      if (segments[3] === "instances" && segments[4]) {
        const instanceId = segments[4];

        // 心跳
        if (segments[5] === "heartbeat" && method === "PUT") {
          return handleHeartbeat(req, res, serviceId, instanceId);
        }

        // 注销
        if (method === "DELETE") {
          return handleDeregister(req, res, serviceId, instanceId);
        }

        // 更新实例状态
        if (method === "PUT") {
          return await updateInstanceStatus(req, res, serviceId, instanceId);
        }
      }

      // 更新服务元数据
      if (segments[3] === "metadata" && method === "PUT") {
        return await updateServiceMetadata(req, res, serviceId);
      }

      // 服务依赖
      if (segments[3] === "dependencies" && method === "GET") {
        return getServiceDependencies(req, res, serviceId);
      }
    }

    // 服务拓扑
    if (
      segments[0] === "api" &&
      segments[1] === "topology" &&
      method === "GET"
    ) {
      return getServiceTopology(req, res);
    }

    // 事件
    if (segments[0] === "api" && segments[1] === "events") {
      if (method === "GET") return getEvents(req, res);
    }

    // 长轮询监听
    if (segments[0] === "api" && segments[1] === "watch" && method === "GET") {
      return await watchEvents(req, res);
    }

    // 集群管理
    if (segments[0] === "api" && segments[1] === "clusters") {
      if (method === "GET") return listClusters(req, res);
      if (method === "POST") return await createCluster(req, res);
    }

    // 统计信息
    if (segments[0] === "api" && segments[1] === "stats" && method === "GET") {
      return getStats(req, res);
    }

    sendError(res, 404, "接口不存在");
  } catch (err) {
    console.error("请求处理错误:", err);
    sendError(res, 500, "服务器内部错误");
  }
}

// 通过 body 注销
async function handleDeregisterViaBody(req, res) {
  const body = await parseBody(req);
  const { serviceId, instanceId } = body;
  if (!serviceId || !instanceId)
    return sendError(res, 400, "缺少 serviceId 或 instanceId");
  handleDeregister(req, res, serviceId, instanceId);
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  const services = loadServices();
  if (services.length === 0) {
    const defaultServices = [
      {
        serviceId: "user-service:1.0.0",
        serviceName: "user-service",
        group: "core",
        version: "1.0.0",
        description: "用户管理服务",
        tags: ["core", "user"],
        metadata: { language: "node.js", framework: "express" },
        dependencies: ["auth-service"],
        createdAt: new Date().toISOString(),
        instances: [
          {
            instanceId: generateId(),
            host: "192.168.1.10",
            port: 3001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "a" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
          {
            instanceId: generateId(),
            host: "192.168.1.11",
            port: 3001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "b" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
        ],
      },
      {
        serviceId: "order-service:1.0.0",
        serviceName: "order-service",
        group: "business",
        version: "1.0.0",
        description: "订单管理服务",
        tags: ["business", "order"],
        metadata: { language: "node.js" },
        dependencies: ["user-service", "product-service", "payment-service"],
        createdAt: new Date().toISOString(),
        instances: [
          {
            instanceId: generateId(),
            host: "192.168.1.20",
            port: 4001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "a" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
        ],
      },
      {
        serviceId: "product-service:1.0.0",
        serviceName: "product-service",
        group: "business",
        version: "1.0.0",
        description: "商品管理服务",
        tags: ["business", "product"],
        metadata: { language: "node.js" },
        dependencies: [],
        createdAt: new Date().toISOString(),
        instances: [
          {
            instanceId: generateId(),
            host: "192.168.1.30",
            port: 5001,
            protocol: "http",
            weight: 2,
            healthy: true,
            status: "up",
            metadata: { zone: "a" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
          {
            instanceId: generateId(),
            host: "192.168.1.31",
            port: 5001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "b" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
          {
            instanceId: generateId(),
            host: "192.168.1.32",
            port: 5002,
            protocol: "http",
            weight: 1,
            healthy: false,
            status: "down",
            metadata: { zone: "c" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date(Date.now() - 60000).toISOString(),
          },
        ],
      },
      {
        serviceId: "auth-service:1.0.0",
        serviceName: "auth-service",
        group: "core",
        version: "1.0.0",
        description: "认证授权服务",
        tags: ["core", "auth"],
        metadata: { language: "node.js" },
        dependencies: [],
        createdAt: new Date().toISOString(),
        instances: [
          {
            instanceId: generateId(),
            host: "192.168.1.40",
            port: 6001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "a" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
        ],
      },
      {
        serviceId: "payment-service:1.0.0",
        serviceName: "payment-service",
        group: "business",
        version: "1.0.0",
        description: "支付服务",
        tags: ["business", "payment"],
        metadata: { language: "java" },
        dependencies: ["auth-service"],
        createdAt: new Date().toISOString(),
        instances: [
          {
            instanceId: generateId(),
            host: "192.168.1.50",
            port: 7001,
            protocol: "http",
            weight: 1,
            healthy: true,
            status: "up",
            metadata: { zone: "a" },
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
        ],
      },
    ];

    saveServices(defaultServices);
  }

  const clusters = loadClusters();
  if (clusters.length === 0) {
    saveClusters([
      {
        name: "core",
        description: "核心基础服务集群",
        createdAt: new Date().toISOString(),
      },
      {
        name: "business",
        description: "业务服务集群",
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

// ==================== 启动服务器 ====================

initDefaultData();

const server = http.createServer(handleRequest);

// 定时心跳检查
const heartbeatTimer = setInterval(checkHeartbeats, HEARTBEAT_CHECK_INTERVAL);

server.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         微服务注册中心已启动                  ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  地址: http://localhost:${PORT}`);
  console.log("");
  console.log("  服务管理:");
  console.log("  ├─ POST   /api/services/register           服务注册");
  console.log("  ├─ POST   /api/services/deregister          服务注销");
  console.log("  ├─ GET    /api/services                     服务列表");
  console.log("  ├─ GET    /api/services/:id                 服务详情");
  console.log("  ├─ GET    /api/services/:id/instances       实例列表");
  console.log("  ├─ PUT    /api/services/:id/instances/:iid  更新实例");
  console.log("  ├─ PUT    /api/services/:id/instances/:iid/heartbeat  心跳");
  console.log("  ├─ DELETE /api/services/:id/instances/:iid  注销实例");
  console.log("  ├─ PUT    /api/services/:id/metadata        更新元数据");
  console.log("  └─ GET    /api/services/:id/dependencies    依赖关系");
  console.log("");
  console.log("  拓扑与事件:");
  console.log("  ├─ GET    /api/topology                     服务拓扑");
  console.log("  ├─ GET    /api/events                       事件列表");
  console.log("  └─ GET    /api/watch                        长轮询监听");
  console.log("");
  console.log("  集群管理:");
  console.log("  ├─ GET    /api/clusters                     集群列表");
  console.log("  └─ POST   /api/clusters                     创建集群");
  console.log("");
  console.log("  统计信息:");
  console.log("  └─ GET    /api/stats                        统计概览");
  console.log("");
  console.log("  心跳超时: " + HEARTBEAT_TIMEOUT / 1000 + "秒");
  console.log("  检查间隔: " + HEARTBEAT_CHECK_INTERVAL / 1000 + "秒");
  console.log("");
  console.log("  默认服务:");
  console.log("  ├─ user-service    (2 实例, core 集群)");
  console.log("  ├─ order-service   (1 实例, business 集群)");
  console.log("  ├─ product-service (3 实例, 1 个不健康, business 集群)");
  console.log("  ├─ auth-service    (1 实例, core 集群)");
  console.log("  └─ payment-service (1 实例, business 集群)");
  console.log("");
  console.log("  健康检查: http://localhost:" + PORT + "/health");
  console.log("");
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n正在关闭微服务注册中心...");
  clearInterval(heartbeatTimer);
  server.close(() => {
    console.log("注册中心已关闭");
    process.exit(0);
  });
});
