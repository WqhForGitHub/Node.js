/**
 * BFF 服务器 (Backend For Frontend)
 *
 * API 聚合层的核心入口
 *
 * 架构：
 *   客户端 (Web/Mobile) --> BFF Server --> 后端微服务集群
 *                                        ├── 用户服务 (:5001)
 *                                        ├── 订单服务 (:5002)
 *                                        ├── 商品服务 (:5003)
 *                                        └── 库存服务 (:5004)
 *
 * 功能：
 * - 按客户端类型路由（/web/*, /mobile/*）
 * - 数据聚合与裁剪
 * - 内存缓存
 * - 请求日志
 * - 统一错误处理
 * - 降级容错
 * - 健康检查
 */

const http = require("http");

const webRoute = require("./routes/web");
const mobileRoute = require("./routes/mobile");
const { cache } = require("./cache");

// ============================================================
// 配置
// ============================================================

const BFF_PORT = process.env.BFF_PORT || 8080;

// 限流配置
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 200;
const rateLimitStore = {};

// 请求统计
const requestStats = {
  total: 0,
  byPath: {},
  errors: 0,
  startTime: Date.now(),
};

// ============================================================
// 工具函数
// ============================================================

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function logRequest(method, path, statusCode, duration, clientType) {
  const timestamp = new Date().toISOString();
  console.log(
    `[BFF] ${timestamp} ${method} ${path} ${statusCode} ${duration}ms [${clientType || "unknown"}]`,
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  if (
    !rateLimitStore[ip] ||
    now - rateLimitStore[ip].windowStart > RATE_LIMIT_WINDOW
  ) {
    rateLimitStore[ip] = { count: 1, windowStart: now };
    return true;
  }
  rateLimitStore[ip].count++;
  return rateLimitStore[ip].count <= RATE_LIMIT_MAX;
}

function detectClientType(path) {
  if (path.startsWith("/web/")) return "web";
  if (path.startsWith("/mobile/")) return "mobile";
  return "unknown";
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// ============================================================
// BFF HTTP 服务器
// ============================================================

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const method = req.method;
  const urlObj = new URL(req.url, `http://127.0.0.1:${BFF_PORT}`);
  const path = urlObj.pathname;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Client-Type",
  );
  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const clientType =
    detectClientType(path) || req.headers["x-client-type"] || "unknown";

  // 更新统计
  requestStats.total++;
  requestStats.byPath[path] = (requestStats.byPath[path] || 0) + 1;

  // ============================================================
  // 健康检查
  // ============================================================
  if (method === "GET" && path === "/health") {
    const cacheStats = cache.getStats();
    logRequest(method, path, 200, Date.now() - startTime, "system");
    return json(res, 200, {
      status: "healthy",
      service: "bff-server",
      uptime: process.uptime(),
      cache: cacheStats,
      requests: {
        total: requestStats.total,
        errors: requestStats.errors,
        uptimeSeconds: Math.floor((Date.now() - requestStats.startTime) / 1000),
      },
    });
  }

  // ============================================================
  // BFF 统计信息
  // ============================================================
  if (method === "GET" && path === "/stats") {
    logRequest(method, path, 200, Date.now() - startTime, "system");
    return json(res, 200, {
      success: true,
      data: {
        requests: requestStats,
        cache: cache.getStats(),
        rateLimitEntries: Object.keys(rateLimitStore).length,
      },
    });
  }

  // ============================================================
  // 限流
  // ============================================================
  const clientIp = req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    logRequest(method, path, 429, Date.now() - startTime, clientType);
    return json(res, 429, {
      success: false,
      error: "请求过于频繁，请稍后再试",
    });
  }

  // ============================================================
  // 路由分发
  // ============================================================
  try {
    let result = null;

    // Web 端路由
    if (path.startsWith("/web/")) {
      result = await webRoute.handle(req, res, path, method, urlObj);
    }
    // 移动端路由
    else if (path.startsWith("/mobile/")) {
      result = await mobileRoute.handle(req, res, path, method, urlObj);
    }

    if (result) {
      const statusCode = result.statusCode || 200;
      logRequest(method, path, statusCode, Date.now() - startTime, clientType);
      return json(res, statusCode, result);
    }
  } catch (err) {
    requestStats.errors++;
    console.error(`[BFF] 聚合错误: ${err.message}`);
    logRequest(method, path, 500, Date.now() - startTime, clientType);
    return json(res, 500, {
      success: false,
      error: "服务聚合异常",
      message: err.message,
    });
  }

  // ============================================================
  // 未匹配路由
  // ============================================================
  logRequest(method, path, 404, Date.now() - startTime, clientType);
  json(res, 404, {
    success: false,
    error: "路由未找到",
    availableRoutes: {
      web: [
        "GET /web/homepage",
        "GET /web/dashboard/:userId",
        "GET /web/orders/:orderId",
        "GET /web/products/:productId",
        "GET /web/products?category=&keyword=",
        "GET /web/users/:userId",
        "POST /web/cache/clear",
      ],
      mobile: [
        "GET /mobile/homepage",
        "GET /mobile/dashboard/:userId",
        "GET /mobile/orders/:orderId",
        "GET /mobile/products/:productId",
        "GET /mobile/products?category=&keyword=",
        "GET /mobile/users/:userId",
      ],
      system: ["GET /health", "GET /stats"],
    },
  });
});

server.listen(BFF_PORT, () => {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         BFF 聚合层服务器已启动                  ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  BFF Server:  http://127.0.0.1:${BFF_PORT}              ║`);
  console.log("║                                                  ║");
  console.log("║  Web 端路由:                                     ║");
  console.log("║    GET /web/homepage                             ║");
  console.log("║    GET /web/dashboard/:userId                    ║");
  console.log("║    GET /web/orders/:orderId                      ║");
  console.log("║    GET /web/products/:productId                  ║");
  console.log("║    GET /web/products?category=&keyword=          ║");
  console.log("║                                                  ║");
  console.log("║  移动端路由:                                     ║");
  console.log("║    GET /mobile/homepage                          ║");
  console.log("║    GET /mobile/dashboard/:userId                 ║");
  console.log("║    GET /mobile/orders/:orderId                   ║");
  console.log("║    GET /mobile/products/:productId               ║");
  console.log("║                                                  ║");
  console.log("║  系统:                                           ║");
  console.log("║    GET /health                                   ║");
  console.log("║    GET /stats                                    ║");
  console.log("╚══════════════════════════════════════════════════╝");
});
