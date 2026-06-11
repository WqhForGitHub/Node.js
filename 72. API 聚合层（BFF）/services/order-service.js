/**
 * 订单服务 (Order Service)
 *
 * 模拟后端微服务 - 订单管理
 * 端口: 5002
 */

const http = require('http');

const PORT = process.env.ORDER_SERVICE_PORT || 5002;

// 模拟订单数据库
const orders = {
  'o001': { id: 'o001', userId: 'u001', items: [{ productId: 'p001', quantity: 2, price: 2999 }, { productId: 'p003', quantity: 1, price: 199 }], totalAmount: 6197, status: 'completed', createdAt: '2024-10-01T10:30:00Z', paidAt: '2024-10-01T10:35:00Z', shippedAt: '2024-10-02T09:00:00Z', address: '北京市朝阳区xxx路' },
  'o002': { id: 'o002', userId: 'u001', items: [{ productId: 'p002', quantity: 1, price: 5999 }], totalAmount: 5999, status: 'shipped', createdAt: '2024-10-15T14:20:00Z', paidAt: '2024-10-15T14:25:00Z', shippedAt: '2024-10-16T08:30:00Z', address: '北京市朝阳区xxx路' },
  'o003': { id: 'o003', userId: 'u002', items: [{ productId: 'p001', quantity: 1, price: 2999 }, { productId: 'p004', quantity: 3, price: 99 }], totalAmount: 3296, status: 'paid', createdAt: '2024-11-01T09:10:00Z', paidAt: '2024-11-01T09:15:00Z', address: '上海市浦东新区xxx街' },
  'o004': { id: 'o004', userId: 'u003', items: [{ productId: 'p002', quantity: 2, price: 5999 }], totalAmount: 11998, status: 'pending', createdAt: '2024-11-20T16:45:00Z', address: '广州市天河区xxx道' },
  'o005': { id: 'o005', userId: 'u001', items: [{ productId: 'p005', quantity: 1, price: 399 }], totalAmount: 399, status: 'cancelled', createdAt: '2024-09-10T11:00:00Z', cancelledAt: '2024-09-10T15:30:00Z', cancelReason: '不想要了', address: '北京市朝阳区xxx路' },
  'o006': { id: 'o006', userId: 'u002', items: [{ productId: 'p003', quantity: 5, price: 199 }, { productId: 'p004', quantity: 10, price: 99 }], totalAmount: 1985, status: 'completed', createdAt: '2024-08-05T08:00:00Z', paidAt: '2024-08-05T08:05:00Z', shippedAt: '2024-08-06T10:00:00Z', address: '上海市浦东新区xxx街' },
};

// 订单统计
function getStatsByUserId(userId) {
  const userOrders = Object.values(orders).filter((o) => o.userId === userId);
  return {
    totalOrders: userOrders.length,
    totalAmount: userOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0),
    completedOrders: userOrders.filter((o) => o.status === 'completed').length,
    pendingOrders: userOrders.filter((o) => o.status === 'pending' || o.status === 'paid').length,
    cancelledOrders: userOrders.filter((o) => o.status === 'cancelled').length,
  };
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`[OrderService] ${method} ${path}`);

  // 健康检查
  if (method === 'GET' && path === '/health') {
    return json(res, 200, { status: 'healthy', service: 'order-service', uptime: process.uptime() });
  }

  // 获取所有订单
  if (method === 'GET' && path === '/orders') {
    const userId = url.searchParams.get('userId');
    let result = Object.values(orders);
    if (userId) result = result.filter((o) => o.userId === userId);
    return json(res, 200, { success: true, data: result, total: result.length });
  }

  // 获取单个订单详情
  if (method === 'GET' && path.startsWith('/orders/') && !path.includes('/stats')) {
    const orderId = path.split('/')[2];
    const order = orders[orderId];
    if (!order) return json(res, 404, { success: false, error: '订单不存在' });
    return json(res, 200, { success: true, data: order });
  }

  // 获取用户订单统计
  if (method === 'GET' && path.match(/^\/orders\/stats\/u\d+$/)) {
    const userId = path.split('/')[3];
    const stats = getStatsByUserId(userId);
    return json(res, 200, { success: true, data: stats });
  }

  // 创建订单
  if (method === 'POST' && path === '/orders') {
    const body = await parseBody(req);
    const newId = 'o' + String(Object.keys(orders).length + 1).padStart(3, '0');
    const newOrder = {
      id: newId,
      userId: body.userId || 'u001',
      items: body.items || [],
      totalAmount: body.totalAmount || 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      address: body.address || '',
    };
    orders[newId] = newOrder;
    return json(res, 201, { success: true, data: newOrder });
  }

  // 更新订单状态
  if (method === 'PUT' && path.startsWith('/orders/')) {
    const orderId = path.split('/')[2];
    if (!orders[orderId]) return json(res, 404, { success: false, error: '订单不存在' });
    const body = await parseBody(req);
    Object.assign(orders[orderId], body);
    return json(res, 200, { success: true, data: orders[orderId] });
  }

  json(res, 404, { success: false, error: '路由未找到' });
});

server.listen(PORT, () => {
  console.log(`[OrderService] 订单服务已启动: http://127.0.0.1:${PORT}`);
});
