/**
 * 库存服务 (Inventory Service)
 *
 * 模拟后端微服务 - 库存管理
 * 端口: 5004
 */

const http = require('http');

const PORT = process.env.INVENTORY_SERVICE_PORT || 5004;

// 模拟库存数据库
const inventory = {
  p001: {
    productId: 'p001',
    stock: 150,
    reserved: 12,
    warehouse: '北京仓',
    restockDate: null,
    lowStockThreshold: 20,
  },
  p002: {
    productId: 'p002',
    stock: 45,
    reserved: 5,
    warehouse: '上海仓',
    restockDate: null,
    lowStockThreshold: 10,
  },
  p003: {
    productId: 'p003',
    stock: 890,
    reserved: 34,
    warehouse: '广州仓',
    restockDate: null,
    lowStockThreshold: 50,
  },
  p004: {
    productId: 'p004',
    stock: 2300,
    reserved: 89,
    warehouse: '北京仓',
    restockDate: null,
    lowStockThreshold: 100,
  },
  p005: {
    productId: 'p005',
    stock: 3,
    reserved: 1,
    warehouse: '上海仓',
    restockDate: '2024-12-01',
    lowStockThreshold: 10,
  },
  p006: {
    productId: 'p006',
    stock: 67,
    reserved: 8,
    warehouse: '广州仓',
    restockDate: null,
    lowStockThreshold: 15,
  },
};

// 库存变更日志
const inventoryLogs = [];

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`[InventoryService] ${method} ${path}`);

  // 健康检查
  if (method === 'GET' && path === '/health') {
    return json(res, 200, {
      status: 'healthy',
      service: 'inventory-service',
      uptime: process.uptime(),
    });
  }

  // 获取所有库存信息
  if (method === 'GET' && path === '/inventory') {
    const lowStockOnly = url.searchParams.get('lowStock') === 'true';
    let result = Object.values(inventory);
    if (lowStockOnly) {
      result = result.filter((i) => i.stock - i.reserved <= i.lowStockThreshold);
    }
    return json(res, 200, { success: true, data: result });
  }

  // 获取单个商品库存
  if (method === 'GET' && path.startsWith('/inventory/')) {
    const productId = path.split('/')[2];
    const item = inventory[productId];
    if (!item) return json(res, 404, { success: false, error: '库存记录不存在' });
    const available = item.stock - item.reserved;
    return json(res, 200, {
      success: true,
      data: {
        ...item,
        available,
        isLowStock: available <= item.lowStockThreshold,
        status:
          available <= 0
            ? 'out_of_stock'
            : available <= item.lowStockThreshold
              ? 'low_stock'
              : 'in_stock',
      },
    });
  }

  // 批量查询库存
  if (method === 'POST' && path === '/inventory/batch') {
    const body = await parseBody(req);
    const ids = body.productIds || [];
    const result = ids
      .map((id) => {
        const item = inventory[id];
        if (!item) return null;
        const available = item.stock - item.reserved;
        return {
          productId: id,
          available,
          status:
            available <= 0
              ? 'out_of_stock'
              : available <= item.lowStockThreshold
                ? 'low_stock'
                : 'in_stock',
        };
      })
      .filter(Boolean);
    return json(res, 200, { success: true, data: result });
  }

  // 预留库存
  if (method === 'POST' && path === '/inventory/reserve') {
    const body = await parseBody(req);
    const { productId, quantity } = body;
    const item = inventory[productId];
    if (!item) return json(res, 404, { success: false, error: '库存记录不存在' });
    const available = item.stock - item.reserved;
    if (available < quantity)
      return json(res, 409, { success: false, error: '库存不足', available });
    item.reserved += quantity;
    inventoryLogs.push({
      productId,
      action: 'reserve',
      quantity,
      timestamp: new Date().toISOString(),
    });
    return json(res, 200, {
      success: true,
      data: {
        productId,
        reserved: quantity,
        available: item.stock - item.reserved,
      },
    });
  }

  json(res, 404, { success: false, error: '路由未找到' });
});

server.listen(PORT, () => {
  console.log(`[InventoryService] 库存服务已启动: http://127.0.0.1:${PORT}`);
});
