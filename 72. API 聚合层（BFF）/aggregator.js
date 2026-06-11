/**
 * 数据聚合器 (Aggregator)
 *
 * BFF 的核心模块 - 负责从多个后端服务拉取数据并聚合
 *
 * 功能：
 * - 并发请求多个后端服务
 * - 请求失败降级（Partial Data）
 * - 超时控制
 * - 缓存集成
 */

const http = require('http');
const { cache, Cache } = require('./cache');

// ============================================================
// 后端服务配置
// ============================================================

const SERVICES = {
  user: { host: '127.0.0.1', port: 5001 },
  order: { host: '127.0.0.1', port: 5002 },
  product: { host: '127.0.0.1', port: 5003 },
  inventory: { host: '127.0.0.1', port: 5004 },
};

// 请求超时配置
const DEFAULT_TIMEOUT = 5000;

// ============================================================
// 通用 HTTP 请求
// ============================================================

/**
 * 向后端服务发起 HTTP 请求
 */
function request(serviceName, path, options = {}) {
  const { method = 'GET', body = null, timeout = DEFAULT_TIMEOUT } = options;
  const service = SERVICES[serviceName];
  if (!service) return Promise.reject(new Error(`未知服务: ${serviceName}`));

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: service.host,
      port: service.port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success === false) {
            reject(new Error(parsed.error || '后端服务返回错误'));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(new Error(`解析响应失败: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`请求超时 (${serviceName})`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ============================================================
// 带缓存的请求
// ============================================================

/**
 * 带缓存的 GET 请求
 */
async function cachedGet(serviceName, path, ttl, postBody) {
  const cacheKey = Cache.key(serviceName, path, postBody ? JSON.stringify(postBody) : '');
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[Aggregator] 缓存命中: ${cacheKey}`);
    return cached;
  }
  const options = postBody ? { method: 'POST', body: postBody } : {};
  const result = await request(serviceName, path, options);
  cache.set(cacheKey, result, ttl);
  return result;
}

// ============================================================
// 降级请求（不抛异常，返回 null）
// ============================================================

/**
 * 降级请求 - 失败返回 null 而非抛异常
 */
async function resilientGet(serviceName, path, ttl, postBody) {
  try {
    return await cachedGet(serviceName, path, ttl, postBody);
  } catch (err) {
    console.warn(`[Aggregator] 请求降级: ${serviceName}${path} - ${err.message}`);
    return null;
  }
}

// ============================================================
// 并发请求工具
// ============================================================

/**
 * 并发执行多个异步任务，收集结果（成功/失败分别处理）
 */
async function parallel(tasks) {
  const entries = Object.entries(tasks);
  const results = await Promise.allSettled(entries.map(([, fn]) => fn()));

  const output = {};
  entries.forEach(([key], index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      output[key] = result.value;
    } else {
      console.warn(`[Aggregator] 并发任务失败 [${key}]: ${result.reason?.message}`);
      output[key] = null;
    }
  });
  return output;
}

// ============================================================
// 聚合 API
// ============================================================

/**
 * 聚合首页数据
 * - 热门商品列表
 * - 商品分类
 * - 库存预警
 */
async function getHomepageData() {
  const { products, categories, lowStockItems } = await parallel({
    products: () => cachedGet('product', '/products', 60000),
    categories: () => cachedGet('product', '/products/categories', 120000),
    lowStockItems: () => resilientGet('inventory', '/inventory?lowStock=true', 30000),
  });

  return {
    categories: categories?.data || [],
    hotProducts: (products?.data || []).slice(0, 4),
    lowStockAlert: (lowStockItems?.data || []).map((item) => ({
      productId: item.productId,
      available: item.stock - item.reserved,
      threshold: item.lowStockThreshold,
    })),
  };
}

/**
 * 聚合用户仪表盘数据
 * - 用户信息
 * - 订单统计
 * - 最近订单
 * - 用户偏好
 */
async function getUserDashboard(userId) {
  const { user, orderStats, recentOrders, preferences } = await parallel({
    user: () => cachedGet('user', `/users/${userId}`, 60000),
    orderStats: () => resilientGet('order', `/orders/stats/${userId}`, 30000),
    recentOrders: () => resilientGet('order', `/orders?userId=${userId}`, 30000),
    preferences: () => resilientGet('user', `/users/${userId}/preferences`, 120000),
  });

  // 取最近 3 条订单
  const orders = (recentOrders?.data || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  return {
    user: user?.data || null,
    orderStats: orderStats?.data || null,
    recentOrders: orders,
    preferences: preferences?.data || null,
  };
}

/**
 * 聚合订单详情数据
 * - 订单信息
 * - 用户信息
 * - 商品详情
 * - 库存状态
 */
async function getOrderDetail(orderId) {
  // 第一步：获取订单信息
  const orderResult = await cachedGet('order', `/orders/${orderId}`, 30000);
  const order = orderResult.data;

  if (!order) return null;

  // 第二步：并发获取关联数据
  const productIds = order.items.map((item) => item.productId);

  const { user, productsBatch, inventoryBatch } = await parallel({
    user: () => resilientGet('user', `/users/${order.userId}`, 60000),
    productsBatch: () => resilientGet('product', '/products/batch', 60000, { ids: productIds }),
    inventoryBatch: () => resilientGet('inventory', '/inventory/batch', 30000, { productIds }),
  });

  // 注意：batch 请求使用 POST，不走缓存直接请求
  const productsMap = {};
  if (productsBatch?.data) {
    productsBatch.data.forEach((p) => { productsMap[p.id] = p; });
  }

  const inventoryMap = {};
  if (inventoryBatch?.data) {
    inventoryBatch.data.forEach((i) => { inventoryMap[i.productId] = i; });
  }

  return {
    order,
    user: user?.data || null,
    productsMap,
    inventoryMap,
  };
}

/**
 * 聚合商品详情页数据
 * - 商品信息
 * - 库存状态
 * - 相关商品（同分类）
 */
async function getProductDetailPage(productId) {
  const { product, inventory, allProducts } = await parallel({
    product: () => cachedGet('product', `/products/${productId}`, 60000),
    inventory: () => resilientGet('inventory', `/inventory/${productId}`, 30000),
    allProducts: () => resilientGet('product', '/products', 60000),
  });

  const productData = product?.data;
  const relatedProducts = (allProducts?.data || [])
    .filter((p) => p.category === productData?.category && p.id !== productId)
    .slice(0, 3);

  return {
    product: productData,
    inventory: inventory?.data || null,
    relatedProducts,
  };
}

/**
 * 聚合商品列表页数据
 * - 商品列表（带筛选）
 * - 库存批量信息
 */
async function getProductListPage(category, keyword) {
  let path = '/products';
  const params = [];
  if (category) params.push(`category=${category}`);
  if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
  if (params.length) path += '?' + params.join('&');

  const productsResult = await cachedGet('product', path, 60000);
  const products = productsResult?.data || [];

  // 批量查库存
  const productIds = products.map((p) => p.id);
  const inventoryResult = await resilientGet('inventory', '/inventory/batch', 30000, { productIds });
  const inventoryMap = {};
  if (inventoryResult?.data) {
    inventoryResult.data.forEach((i) => { inventoryMap[i.productId] = i; });
  }

  return { products, inventoryMap };
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  request,
  cachedGet,
  resilientGet,
  parallel,
  getHomepageData,
  getUserDashboard,
  getOrderDetail,
  getProductDetailPage,
  getProductListPage,
  SERVICES,
};
