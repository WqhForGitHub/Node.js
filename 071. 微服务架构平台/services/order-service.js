/**
 * 订单服务 (Order Service)
 *
 * 功能：
 * - 创建订单
 * - 查询订单（按 ID / 按用户 ID）
 * - 订单列表（分页）
 * - 更新订单状态
 * - 取消订单
 *
 * 数据存储：内存（Demo 用途）
 *
 * 跨服务依赖：
 * - user-service: 验证用户是否存在
 * - product-service: 获取产品信息、扣减库存
 */

const http = require("http");
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

const SERVICE_NAME = "order-service";
const HOST = process.env.SERVICE_HOST || "127.0.0.1";
const PORT = process.env.ORDER_SERVICE_PORT || 3002;

// ============================================================
// 数据存储
// ============================================================

const orders = new Map();
let orderIdCounter = 1000;

// 订单状态流转
const ORDER_STATUS = {
  PENDING: "pending", // 待处理
  CONFIRMED: "confirmed", // 已确认
  SHIPPED: "shipped", // 已发货
  DELIVERED: "delivered", // 已送达
  CANCELLED: "cancelled", // 已取消
};

// 初始化示例数据
const demoOrders = [
  {
    userId: "1",
    productId: "p001",
    quantity: 2,
    status: ORDER_STATUS.DELIVERED,
  },
  { userId: "2", productId: "p002", quantity: 1, status: ORDER_STATUS.SHIPPED },
  {
    userId: "2",
    productId: "p003",
    quantity: 3,
    status: ORDER_STATUS.CONFIRMED,
  },
  { userId: "3", productId: "p001", quantity: 1, status: ORDER_STATUS.PENDING },
];

demoOrders.forEach((o) => {
  const id = `ORD-${orderIdCounter++}`;
  orders.set(id, {
    id,
    userId: o.userId,
    productId: o.productId,
    quantity: o.quantity,
    status: o.status,
    totalPrice: null,
    createdAt: Date.now() - Math.floor(Math.random() * 86400000),
    updatedAt: null,
  });
});

// ============================================================
// 路由
// ============================================================

const router = new Router();

// POST /api/orders - 创建订单
router.post("/api/orders", async (req, res) => {
  const body = await readBody(req);
  const { userId, productId, quantity } = body;

  if (!userId || !productId || !quantity) {
    return errorResponse(res, "userId, productId, quantity 必填");
  }

  if (quantity <= 0) {
    return errorResponse(res, "数量必须大于 0");
  }

  // 跨服务调用：验证用户
  let user = null;
  try {
    const userResult = await callService({
      serviceName: "user-service",
      path: `/api/users/${userId}`,
    });
    if (userResult.statusCode === 200 && userResult.body.success) {
      user = userResult.body.user;
    }
  } catch (err) {
    console.warn(`[OrderService] 验证用户失败: ${err.message}`);
  }

  if (!user) {
    return errorResponse(res, "用户不存在", 400);
  }

  // 跨服务调用：获取产品信息
  let product = null;
  try {
    const productResult = await callService({
      serviceName: "product-service",
      path: `/api/products/${productId}`,
    });
    if (productResult.statusCode === 200 && productResult.body.success) {
      product = productResult.body.product;
    }
  } catch (err) {
    console.warn(`[OrderService] 获取产品信息失败: ${err.message}`);
  }

  if (!product) {
    return errorResponse(res, "产品不存在", 400);
  }

  if (product.stock < quantity) {
    return errorResponse(res, `库存不足，当前库存: ${product.stock}`, 409);
  }

  // 创建订单
  const id = `ORD-${orderIdCounter++}`;
  const order = {
    id,
    userId,
    productId,
    productName: product.name,
    quantity,
    unitPrice: product.price,
    totalPrice: product.price * quantity,
    status: ORDER_STATUS.PENDING,
    createdAt: Date.now(),
    updatedAt: null,
  };
  orders.set(id, order);

  // 跨服务调用：扣减库存
  try {
    await callService({
      serviceName: "product-service",
      path: `/api/products/${productId}/stock`,
      method: "PUT",
      body: { quantity: -quantity },
    });
  } catch (err) {
    console.warn(`[OrderService] 扣减库存失败: ${err.message}`);
  }

  successResponse(res, { message: "订单创建成功", order }, 201);
});

// GET /api/orders - 订单列表（支持 userId 过滤）
router.get("/api/orders", async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = parseInt(url.searchParams.get("limit")) || 10;

  let filtered = Array.from(orders.values());

  if (userId) {
    filtered = filtered.filter((o) => o.userId === userId);
  }
  if (status) {
    filtered = filtered.filter((o) => o.status === status);
  }

  // 按创建时间降序
  filtered.sort((a, b) => b.createdAt - a.createdAt);

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  successResponse(res, {
    orders: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/orders/:id - 订单详情
router.get("/api/orders/:id", async (req, res, params) => {
  const order = orders.get(params.id);
  if (!order) {
    return errorResponse(res, "订单不存在", 404);
  }
  successResponse(res, { order });
});

// PUT /api/orders/:id/status - 更新订单状态
router.put("/api/orders/:id/status", async (req, res, params) => {
  const order = orders.get(params.id);
  if (!order) {
    return errorResponse(res, "订单不存在", 404);
  }

  const body = await readBody(req);
  const { status } = body;

  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(status)) {
    return errorResponse(res, `无效状态，可选: ${validStatuses.join(", ")}`);
  }

  // 状态流转校验
  const transitions = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  };

  const allowed = transitions[order.status] || [];
  if (!allowed.includes(status)) {
    return errorResponse(res, `不允许从 ${order.status} 转换到 ${status}`, 409);
  }

  order.status = status;
  order.updatedAt = Date.now();

  // 如果取消，恢复库存
  if (status === ORDER_STATUS.CANCELLED) {
    try {
      await callService({
        serviceName: "product-service",
        path: `/api/products/${order.productId}/stock`,
        method: "PUT",
        body: { quantity: order.quantity },
      });
    } catch (err) {
      console.warn(`[OrderService] 恢复库存失败: ${err.message}`);
    }
  }

  successResponse(res, { message: "状态更新成功", order });
});

// DELETE /api/orders/:id - 取消订单
router.delete("/api/orders/:id", async (req, res, params) => {
  const order = orders.get(params.id);
  if (!order) {
    return errorResponse(res, "订单不存在", 404);
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    return errorResponse(res, "订单已取消", 409);
  }

  if (
    order.status === ORDER_STATUS.SHIPPED ||
    order.status === ORDER_STATUS.DELIVERED
  ) {
    return errorResponse(res, "已发货/已送达订单不可取消", 409);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.updatedAt = Date.now();

  // 恢复库存
  try {
    await callService({
      serviceName: "product-service",
      path: `/api/products/${order.productId}/stock`,
      method: "PUT",
      body: { quantity: order.quantity },
    });
  } catch (err) {
    console.warn(`[OrderService] 恢复库存失败: ${err.message}`);
  }

  successResponse(res, { message: "订单已取消", order });
});

// GET /health - 健康检查
router.get("/health", async (req, res) => {
  successResponse(res, {
    status: "healthy",
    service: SERVICE_NAME,
    host: HOST,
    port: PORT,
    uptime: process.uptime(),
    orderCount: orders.size,
  });
});

// ============================================================
// 启动服务
// ============================================================

const server = http.createServer(async (req, res) => {
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
  console.log(`[OrderService] 订单服务已启动: http://${HOST}:${PORT}`);

  try {
    const registration = await registerAndHeartbeat({
      name: SERVICE_NAME,
      host: HOST,
      port: PORT,
      metadata: { version: "1.0.0", description: "订单管理服务" },
    });

    process.on("SIGINT", async () => {
      console.log(`\n[${SERVICE_NAME}] 正在关闭...`);
      await registration.deregister();
      server.close(() => {
        console.log(`[${SERVICE_NAME}] 已关闭`);
        process.exit(0);
      });
    });
  } catch (err) {
    console.error(`[OrderService] 注册失败: ${err.message}`);
  }
});
