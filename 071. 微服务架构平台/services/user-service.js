/**
 * 用户服务 (User Service)
 *
 * 功能：
 * - 用户注册
 * - 用户登录（返回 JWT Token）
 * - 用户信息查询
 * - 用户列表
 * - 用户更新 / 删除
 *
 * 数据存储：内存（Demo 用途）
 */

const http = require("http");
const crypto = require("crypto");
const {
  registerAndHeartbeat,
  successResponse,
  errorResponse,
  readBody,
  Router,
  callService,
} = require("../common");

// ============================================================
// 配置
// ============================================================

const SERVICE_NAME = "user-service";
const HOST = process.env.SERVICE_HOST || "127.0.0.1";
const PORT = process.env.USER_SERVICE_PORT || 3001;
const JWT_SECRET = "microservices-demo-secret-2024";

// ============================================================
// 数据存储
// ============================================================

const users = new Map();
let userIdCounter = 1;

// 初始化一些示例数据
const demoUsers = [
  {
    username: "admin",
    password: "admin123",
    nickname: "管理员",
    role: "admin",
  },
  { username: "zhangsan", password: "123456", nickname: "张三", role: "user" },
  { username: "lisi", password: "123456", nickname: "李四", role: "user" },
];

demoUsers.forEach((u) => {
  const id = String(userIdCounter++);
  const hashedPassword = hashPassword(u.password);
  users.set(id, {
    id,
    username: u.username,
    password: hashedPassword,
    nickname: u.nickname,
    role: u.role,
    createdAt: Date.now(),
  });
});

// ============================================================
// 工具函数
// ============================================================

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password + "salt-demo")
    .digest("hex");
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString();
}

function createToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, exp: Date.now() + 86400000 }),
  );
  const signature = base64UrlEncode(
    crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64"),
  );
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = base64UrlEncode(
      crypto
        .createHmac("sha256", JWT_SECRET)
        .update(`${header}.${body}`)
        .digest("base64"),
    );
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// ============================================================
// 路由
// ============================================================

const router = new Router();

// POST /register - 用户注册
router.post("/api/users/register", async (req, res) => {
  const body = await readBody(req);
  const { username, password, nickname, role } = body;

  if (!username || !password) {
    return errorResponse(res, "用户名和密码必填");
  }

  // 检查用户名是否已存在
  for (const [, user] of users) {
    if (user.username === username) {
      return errorResponse(res, "用户名已存在", 409);
    }
  }

  const id = String(userIdCounter++);
  const user = {
    id,
    username,
    password: hashPassword(password),
    nickname: nickname || username,
    role: role || "user",
    createdAt: Date.now(),
  };
  users.set(id, user);

  // 创建 JWT
  const token = createToken({ userId: id, username, role: user.role });

  successResponse(
    res,
    {
      message: "注册成功",
      user: sanitizeUser(user),
      token,
    },
    201,
  );
});

// POST /login - 用户登录
router.post("/api/users/login", async (req, res) => {
  const body = await readBody(req);
  const { username, password } = body;

  if (!username || !password) {
    return errorResponse(res, "用户名和密码必填");
  }

  // 查找用户
  let foundUser = null;
  for (const [, user] of users) {
    if (user.username === username) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser || foundUser.password !== hashPassword(password)) {
    return errorResponse(res, "用户名或密码错误", 401);
  }

  const token = createToken({
    userId: foundUser.id,
    username: foundUser.username,
    role: foundUser.role,
  });

  successResponse(res, {
    message: "登录成功",
    user: sanitizeUser(foundUser),
    token,
  });
});

// GET /api/users - 用户列表
router.get("/api/users", async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = parseInt(url.searchParams.get("limit")) || 10;

  const allUsers = Array.from(users.values()).map(sanitizeUser);
  const total = allUsers.length;
  const start = (page - 1) * limit;
  const paged = allUsers.slice(start, start + limit);

  successResponse(res, {
    users: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/users/:id - 用户详情
router.get("/api/users/:id", async (req, res, params) => {
  const user = users.get(params.id);
  if (!user) {
    return errorResponse(res, "用户不存在", 404);
  }

  // 跨服务调用：获取该用户的订单
  let orders = [];
  try {
    const result = await callService({
      serviceName: "order-service",
      path: `/api/orders?userId=${params.id}`,
    });
    if (result.statusCode === 200 && result.body.success) {
      orders = result.body.orders || [];
    }
  } catch (err) {
    console.warn(`[UserService] 获取用户订单失败: ${err.message}`);
  }

  successResponse(res, {
    user: sanitizeUser(user),
    orders,
  });
});

// PUT /api/users/:id - 更新用户
router.put("/api/users/:id", async (req, res, params) => {
  const user = users.get(params.id);
  if (!user) {
    return errorResponse(res, "用户不存在", 404);
  }

  const body = await readBody(req);
  if (body.nickname !== undefined) user.nickname = body.nickname;
  if (body.role !== undefined) user.role = body.role;
  if (body.password) user.password = hashPassword(body.password);
  user.updatedAt = Date.now();

  successResponse(res, { message: "更新成功", user: sanitizeUser(user) });
});

// DELETE /api/users/:id - 删除用户
router.delete("/api/users/:id", async (req, res, params) => {
  const user = users.get(params.id);
  if (!user) {
    return errorResponse(res, "用户不存在", 404);
  }

  users.delete(params.id);
  successResponse(res, { message: "删除成功" });
});

// GET /health - 健康检查
router.get("/health", async (req, res) => {
  successResponse(res, {
    status: "healthy",
    service: SERVICE_NAME,
    host: HOST,
    port: PORT,
    uptime: process.uptime(),
    userCount: users.size,
  });
});

// ============================================================
// 启动服务
// ============================================================

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const handled = await router.handle(req, res);
  if (!handled) {
    errorResponse(res, "路由未找到", 404);
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`[UserService] 用户服务已启动: http://${HOST}:${PORT}`);

  // 注册到服务中心
  try {
    const registration = await registerAndHeartbeat({
      name: SERVICE_NAME,
      host: HOST,
      port: PORT,
      metadata: { version: "1.0.0", description: "用户管理服务" },
    });

    // 优雅关闭
    process.on("SIGINT", async () => {
      console.log(`\n[${SERVICE_NAME}] 正在关闭...`);
      await registration.deregister();
      server.close(() => {
        console.log(`[${SERVICE_NAME}] 已关闭`);
        process.exit(0);
      });
    });
  } catch (err) {
    console.error(`[UserService] 注册失败: ${err.message}`);
  }
});
