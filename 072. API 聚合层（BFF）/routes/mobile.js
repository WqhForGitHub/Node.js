/**
 * 移动端 BFF 路由
 *
 * 面向移动 App 客户端的聚合接口
 * 特点：
 * - 返回精简数据，减少传输量
 * - 减少请求次数，一次获取所有需要的数据
 * - 适合小屏幕的关键信息展示
 */

const aggregator = require('../aggregator');
const { UserTransformer, ProductTransformer, OrderTransformer } = require('../transformer');

/**
 * 处理移动端请求
 */
async function handle(req, res, path, method, url) {
  // ============================================================
  // GET /mobile/homepage - 移动端首页（精简热门商品）
  // ============================================================
  if (method === 'GET' && path === '/mobile/homepage') {
    const data = await aggregator.getHomepageData();

    return {
      success: true,
      data: {
        categories: data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
        })),
        hotProducts: data.hotProducts.map((p) => ProductTransformer.toMobileListItem(p)),
      },
      meta: {
        ts: Date.now(), // 移动端用更短的 key
      },
    };
  }

  // ============================================================
  // GET /mobile/dashboard/:userId - 用户仪表盘（移动端精简版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/mobile\/dashboard\/u\d+$/)) {
    const userId = path.split('/')[3];
    const data = await aggregator.getUserDashboard(userId);

    return {
      success: true,
      data: {
        user: data.user ? UserTransformer.toMobileDetail(data.user) : null,
        orderStats: data.orderStats
          ? {
              total: data.orderStats.totalOrders,
              pending: data.orderStats.pendingOrders,
            }
          : null,
        recentOrders: (data.recentOrders || []).slice(0, 3).map((o) => ({
          id: o.id,
          totalAmount: o.totalAmount,
          status: o.status,
          statusText: OrderTransformer._statusText(o.status),
          itemCount: o.items.length,
          createdAt: o.createdAt,
        })),
      },
      meta: { ts: Date.now() },
    };
  }

  // ============================================================
  // GET /mobile/orders/:orderId - 订单详情（移动端精简版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/mobile\/orders\/o\d+$/)) {
    const orderId = path.split('/')[3];
    const data = await aggregator.getOrderDetail(orderId);

    if (!data) {
      return { success: false, error: '订单不存在', statusCode: 404 };
    }

    const productsMap = {};
    Object.entries(data.productsMap).forEach(([id, p]) => {
      productsMap[id] = ProductTransformer.toOrderEmbedded(p);
    });

    return {
      success: true,
      data: OrderTransformer.toMobileDetail(data.order, productsMap),
      meta: { ts: Date.now() },
    };
  }

  // ============================================================
  // GET /mobile/products/:productId - 商品详情（移动端精简版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/mobile\/products\/p\d+$/)) {
    const productId = path.split('/')[3];
    const data = await aggregator.getProductDetailPage(productId);

    if (!data.product) {
      return { success: false, error: '商品不存在', statusCode: 404 };
    }

    return {
      success: true,
      data: {
        ...ProductTransformer.toMobileDetail(data.product, data.inventory),
        description: data.product.description,
        specs: data.product.specs,
        relatedProducts: data.relatedProducts.map((p) => ProductTransformer.toMobileListItem(p)),
      },
      meta: { ts: Date.now() },
    };
  }

  // ============================================================
  // GET /mobile/products - 商品列表（移动端精简版）
  // ============================================================
  if (method === 'GET' && path === '/mobile/products') {
    const category = url.searchParams.get('category');
    const keyword = url.searchParams.get('keyword');
    const data = await aggregator.getProductListPage(category, keyword);

    return {
      success: true,
      data: data.products.map((p) => {
        const inv = data.inventoryMap[p.id];
        return {
          ...ProductTransformer.toMobileListItem(p),
          stockStatus: inv ? inv.status : 'unknown',
        };
      }),
      meta: { ts: Date.now(), total: data.products.length },
    };
  }

  // ============================================================
  // GET /mobile/users/:userId - 用户信息（移动端精简版）
  // ============================================================
  if (method === 'GET' && path.match(/^\/mobile\/users\/u\d+$/)) {
    const userId = path.split('/')[3];
    const result = await aggregator.resilientGet('user', `/users/${userId}`, 60000);

    if (!result?.data) {
      return { success: false, error: '用户不存在', statusCode: 404 };
    }

    return {
      success: true,
      data: UserTransformer.toMobileDetail(result.data),
      meta: { ts: Date.now() },
    };
  }

  return null; // 未匹配
}

module.exports = { handle };
