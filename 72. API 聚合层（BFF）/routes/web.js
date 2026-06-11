/**
 * Web 端 BFF 路由
 *
 * 面向 Web 浏览器客户端的聚合接口
 * 特点：
 * - 返回完整详细的数据
 * - 包含关联数据的嵌入
 * - 适合大屏幕展示的丰富信息
 */

const aggregator = require('../aggregator');
const { UserTransformer, ProductTransformer, OrderTransformer } = require('../transformer');
const { cache } = require('../cache');

/**
 * 处理 Web 端请求
 */
async function handle(req, res, path, method, url) {
  // ============================================================
  // GET /web/homepage - Web 首页聚合数据
  // ============================================================
  if (method === 'GET' && path === '/web/homepage') {
    const data = await aggregator.getHomepageData();
    return {
      success: true,
      data: {
        categories: data.categories,
        hotProducts: data.hotProducts.map((p) => ProductTransformer.toWebListItem(p)),
        lowStockAlert: data.lowStockAlert,
      },
      meta: {
        timestamp: new Date().toISOString(),
        source: 'bff-web',
      },
    };
  }

  // ============================================================
  // GET /web/dashboard/:userId - 用户仪表盘（Web 版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/web\/dashboard\/u\d+$/)) {
    const userId = path.split('/')[3];
    const data = await aggregator.getUserDashboard(userId);

    return {
      success: true,
      data: {
        user: data.user ? UserTransformer.toWebDetail(data.user) : null,
        orderStats: data.orderStats,
        recentOrders: (data.recentOrders || []).map((o) => OrderTransformer.toListItem(o)),
        preferences: data.preferences,
      },
      meta: {
        timestamp: new Date().toISOString(),
        source: 'bff-web',
        partial: !data.user || !data.orderStats,
      },
    };
  }

  // ============================================================
  // GET /web/orders/:orderId - 订单详情（Web 版 - 完整关联数据）
  // ============================================================
  if (method === 'GET' && path.match(/^\/web\/orders\/o\d+$/)) {
    const orderId = path.split('/')[3];
    const data = await aggregator.getOrderDetail(orderId);

    if (!data) {
      return { success: false, error: '订单不存在', statusCode: 404 };
    }

    return {
      success: true,
      data: OrderTransformer.toWebDetail(
        data.order,
        data.user ? UserTransformer.toEmbedded(data.user) : null,
        Object.fromEntries(
          Object.entries(data.productsMap).map(([id, p]) => [id, ProductTransformer.toOrderEmbedded(p)])
        )
      ),
      meta: {
        timestamp: new Date().toISOString(),
        source: 'bff-web',
        inventoryInfo: data.inventoryMap,
      },
    };
  }

  // ============================================================
  // GET /web/products/:productId - 商品详情页（Web 版 - 完整规格）
  // ============================================================
  if (method === 'GET' && path.match(/^\/web\/products\/p\d+$/)) {
    const productId = path.split('/')[3];
    const data = await aggregator.getProductDetailPage(productId);

    if (!data.product) {
      return { success: false, error: '商品不存在', statusCode: 404 };
    }

    return {
      success: true,
      data: {
        ...ProductTransformer.toWebDetail(data.product, data.inventory),
        relatedProducts: data.relatedProducts.map((p) => ProductTransformer.toWebListItem(p)),
      },
      meta: {
        timestamp: new Date().toISOString(),
        source: 'bff-web',
      },
    };
  }

  // ============================================================
  // GET /web/products - 商品列表页（Web 版 - 带库存状态）
  // ============================================================
  if (method === 'GET' && path === '/web/products') {
    const category = url.searchParams.get('category');
    const keyword = url.searchParams.get('keyword');
    const data = await aggregator.getProductListPage(category, keyword);

    return {
      success: true,
      data: data.products.map((p) => {
        const inv = data.inventoryMap[p.id];
        return {
          ...ProductTransformer.toWebListItem(p),
          stockStatus: inv ? inv.status : 'unknown',
          available: inv ? inv.available : null,
        };
      }),
      meta: {
        timestamp: new Date().toISOString(),
        source: 'bff-web',
        total: data.products.length,
        filters: { category, keyword },
      },
    };
  }

  // ============================================================
  // GET /web/users/:userId - 用户详情（Web 版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/web\/users\/u\d+$/)) {
    const userId = path.split('/')[3];
    const { user, preferences } = await aggregator.parallel({
      user: () => aggregator.cachedGet('user', `/users/${userId}`, 60000),
      preferences: () => aggregator.resilientGet('user', `/users/${userId}/preferences`, 120000),
    });

    if (!user?.data) {
      return { success: false, error: '用户不存在', statusCode: 404 };
    }

    return {
      success: true,
      data: {
        ...UserTransformer.toWebDetail(user.data),
        preferences: preferences?.data || null,
      },
      meta: { timestamp: new Date().toISOString(), source: 'bff-web' },
    };
  }

  // ============================================================
  // POST /web/cache/clear - 清除缓存
  // ============================================================
  if (method === 'POST' && path === '/web/cache/clear') {
    cache.clear();
    return { success: true, message: '缓存已清除' };
  }

  return null; // 未匹配
}

module.exports = { handle };
