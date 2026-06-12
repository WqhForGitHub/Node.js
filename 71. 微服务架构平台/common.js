/**
 * 公共模块 (Common Module)
 *
 * 提供：
 * - 服务自动注册 & 心跳保活
 * - 跨服务调用（通过注册中心服务发现）
 * - 统一 HTTP 响应工具
 * - 简易日志
 */

const http = require("http");

// ============================================================
// 服务注册 & 心跳
// ============================================================

/**
 * 向注册中心注册服务，并启动心跳定时器
 *
 * @param {object} options
 * @param {string} options.name      - 服务名称
 * @param {string} options.host      - 服务主机
 * @param {number} options.port      - 服务端口
 * @param {object} [options.metadata] - 元数据
 * @param {string} [options.registryHost] - 注册中心主机
 * @param {number} [options.registryPort] - 注册中心端口
 * @param {number} [options.heartbeatInterval] - 心跳间隔(ms)，默认 5000
 * @returns {Promise<object>} 注册结果
 */
function registerAndHeartbeat({
  name,
  host = "127.0.0.1",
  port,
  metadata = {},
  registryHost = process.env.REGISTRY_HOST || "127.0.0.1",
  registryPort = process.env.REGISTRY_PORT || 4000,
  heartbeatInterval = 5000,
}) {
  async function sendHeartbeat() {
    try {
      await registryRequest({
        hostname: registryHost,
        port: registryPort,
        path: "/heartbeat",
        method: "POST",
        body: { name, host, port },
        timeout: 3000,
      });
    } catch (err) {
      console.warn(`[Common] 心跳失败 (${name}): ${err.message}`);
    }
  }

  // 注册
  return registryRequest({
    hostname: registryHost,
    port: registryPort,
    path: "/register",
    method: "POST",
    body: { name, host, port, metadata },
    timeout: 3000,
  })
    .then((result) => {
      console.log(`[Common] 服务注册成功: ${name}@${host}:${port}`);
      // 启动心跳
      const timer = setInterval(sendHeartbeat, heartbeatInterval);
      // 返回注销函数
      return {
        result,
        timer,
        async deregister() {
          clearInterval(timer);
          try {
            await registryRequest({
              hostname: registryHost,
              port: registryPort,
              path: "/deregister",
              method: "POST",
              body: { name, host, port },
              timeout: 3000,
            });
            console.log(`[Common] 服务注销成功: ${name}@${host}:${port}`);
          } catch (err) {
            console.warn(`[Common] 服务注销失败: ${err.message}`);
          }
        },
      };
    })
    .catch((err) => {
      console.error(`[Common] 服务注册失败 (${name}): ${err.message}`);
      // 注册失败时启动重试
      return new Promise((resolve) => {
        const retryTimer = setInterval(async () => {
          try {
            const result = await registryRequest({
              hostname: registryHost,
              port: registryPort,
              path: "/register",
              method: "POST",
              body: { name, host, port, metadata },
              timeout: 3000,
            });
            clearInterval(retryTimer);
            console.log(`[Common] 服务注册成功(重试): ${name}@${host}:${port}`);
            const heartbeatTimer = setInterval(
              sendHeartbeat,
              heartbeatInterval,
            );
            resolve({
              result,
              timer: heartbeatTimer,
              async deregister() {
                clearInterval(heartbeatTimer);
                try {
                  await registryRequest({
                    hostname: registryHost,
                    port: registryPort,
                    path: "/deregister",
                    method: "POST",
                    body: { name, host, port },
                    timeout: 3000,
                  });
                  console.log(`[Common] 服务注销成功: ${name}@${host}:${port}`);
                } catch (e) {
                  console.warn(`[Common] 服务注销失败: ${e.message}`);
                }
              },
            });
          } catch {
            // 继续重试
          }
        }, 5000);
      });
    });
}

// ============================================================
// 跨服务调用
// ============================================================

/**
 * 通过注册中心服务发现 + 负载均衡调用其他微服务
 *
 * @param {object} options
 * @param {string} options.serviceName  - 目标服务名称
 * @param {string} options.path         - 请求路径 (如 /api/users/1)
 * @param {string} [options.method]     - HTTP 方法，默认 GET
 * @param {object} [options.body]       - 请求体
 * @param {object} [options.headers]    - 额外请求头
 * @param {number} [options.timeout]    - 超时(ms)，默认 8000
 * @param {string} [options.registryHost]
 * @param {number} [options.registryPort]
 * @param {string} [options.strategy]   - 负载均衡策略 round-robin | random
 * @returns {Promise<{statusCode, headers, body}>}
 */
async function callService({
  serviceName,
  path,
  method = "GET",
  body = null,
  headers = {},
  timeout = 8000,
  registryHost = process.env.REGISTRY_HOST || "127.0.0.1",
  registryPort = process.env.REGISTRY_PORT || 4000,
  strategy = "round-robin",
}) {
  // 1. 服务发现
  const discovery = await registryRequest({
    hostname: registryHost,
    port: registryPort,
    path: `/load-balance/${serviceName}?strategy=${strategy}`,
    method: "GET",
    timeout: 3000,
  });

  if (!discovery.success || !discovery.instance) {
    throw new Error(`服务 ${serviceName} 无可用实例`);
  }

  const instance = discovery.instance;

  // 2. 发起请求
  return new Promise((resolve, reject) => {
    const options = {
      hostname: instance.host,
      port: instance.port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "x-caller-service": serviceName,
        ...headers,
      },
      timeout,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          /* 非 JSON 响应 */
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`调用 ${serviceName} 超时`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ============================================================
// 注册中心 HTTP 请求工具
// ============================================================

function registryRequest({
  hostname,
  port,
  path,
  method,
  body = null,
  timeout = 3000,
}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method,
      headers: { "Content-Type": "application/json" },
      timeout,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("解析注册中心响应失败"));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("注册中心请求超时"));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ============================================================
// 统一 HTTP 响应工具
// ============================================================

function jsonResponse(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function successResponse(res, data = {}, code = 200) {
  jsonResponse(res, code, { success: true, ...data });
}

function errorResponse(res, message, code = 400) {
  jsonResponse(res, code, { success: false, error: message });
}

// ============================================================
// 请求体读取
// ============================================================

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// ============================================================
// 简易路由器
// ============================================================

class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * 注册路由
   * @param {string} method - HTTP 方法
   * @param {string|RegExp} pattern - 路径模式，如 /api/users/:id
   * @param {function} handler - (req, res, params) => {}
   */
  add(method, pattern, handler) {
    this.routes.push({ method: method.toUpperCase(), pattern, handler });
  }

  get(pattern, handler) {
    this.add("GET", pattern, handler);
  }
  post(pattern, handler) {
    this.add("POST", pattern, handler);
  }
  put(pattern, handler) {
    this.add("PUT", pattern, handler);
  }
  delete(pattern, handler) {
    this.add("DELETE", pattern, handler);
  }

  /**
   * 匹配并执行路由
   * @returns {boolean} 是否匹配到路由
   */
  async handle(req, res) {
    const method = req.method.toUpperCase();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = this._match(route.pattern, pathname);
      if (params !== null) {
        try {
          await route.handler(req, res, params);
        } catch (err) {
          console.error(`[Router] 处理异常: ${err.message}`);
          errorResponse(res, "服务器内部错误", 500);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 路径模式匹配，支持 :param 参数
   * @returns {object|null} 匹配则返回参数对象，否则 null
   */
  _match(pattern, pathname) {
    if (pattern instanceof RegExp) {
      const m = pathname.match(pattern);
      if (!m) return null;
      const params = {};
      // 不支持命名分组，仅返回匹配
      return params;
    }

    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  registerAndHeartbeat,
  callService,
  jsonResponse,
  successResponse,
  errorResponse,
  readBody,
  Router,
};
