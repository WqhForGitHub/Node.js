/**
 * 数据转换器 (Data Transformer)
 *
 * 功能：
 * - 根据不同客户端需求裁剪/转换数据
 * - Web 端需要详细信息，移动端需要精简信息
 * - 统一数据格式
 * - 敏感字段过滤
 */

// ============================================================
// 用户数据转换
// ============================================================

const UserTransformer = {
  /**
   * Web 端用户详情 - 完整信息
   */
  toWebDetail(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      level: user.level,
      phone: user.phone,
      address: user.address,
      registeredAt: user.registeredAt,
    };
  },

  /**
   * 移动端用户详情 - 精简信息
   */
  toMobileDetail(user) {
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      level: user.level,
    };
  },

  /**
   * 用户列表项 - 嵌入其他聚合数据时使用
   */
  toEmbedded(user) {
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      level: user.level,
    };
  },
};

// ============================================================
// 商品数据转换
// ============================================================

const ProductTransformer = {
  /**
   * Web 端商品详情 - 完整规格
   */
  toWebDetail(product, inventoryInfo) {
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: Math.round((1 - product.price / product.originalPrice) * 100),
      description: product.description,
      images: product.images,
      specs: product.specs,
      rating: product.rating,
      reviewCount: product.reviewCount,
      tags: product.tags,
      stock: inventoryInfo ? {
        available: inventoryInfo.available,
        status: inventoryInfo.status,
        warehouse: inventoryInfo.warehouse,
      } : null,
    };
  },

  /**
   * 移动端商品详情 - 精简规格
   */
  toMobileDetail(product, inventoryInfo) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.images[0] || null,
      rating: product.rating,
      stockStatus: inventoryInfo ? inventoryInfo.status : 'unknown',
    };
  },

  /**
   * 商品列表项（Web）
   */
  toWebListItem(product) {
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.images[0] || null,
      rating: product.rating,
      reviewCount: product.reviewCount,
      tags: product.tags,
    };
  },

  /**
   * 商品列表项（移动端）- 更精简
   */
  toMobileListItem(product) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] || null,
      rating: product.rating,
    };
  },

  /**
   * 订单中的商品嵌入信息
   */
  toOrderEmbedded(product) {
    return {
      id: product.id,
      name: product.name,
      image: product.images[0] || null,
    };
  },
};

// ============================================================
// 订单数据转换
// ============================================================

const OrderTransformer = {
  /**
   * Web 端订单详情 - 完整信息
   */
  toWebDetail(order, userEmbedded, productEmbeddedMap) {
    return {
      id: order.id,
      user: userEmbedded,
      items: order.items.map((item) => ({
        ...item,
        product: productEmbeddedMap[item.productId] || null,
      })),
      totalAmount: order.totalAmount,
      status: order.status,
      statusText: this._statusText(order.status),
      createdAt: order.createdAt,
      paidAt: order.paidAt || null,
      shippedAt: order.shippedAt || null,
      cancelledAt: order.cancelledAt || null,
      cancelReason: order.cancelReason || null,
      address: order.address,
    };
  },

  /**
   * 移动端订单详情 - 精简信息
   */
  toMobileDetail(order, productEmbeddedMap) {
    return {
      id: order.id,
      items: order.items.map((item) => ({
        product: productEmbeddedMap[item.productId] || { id: item.productId },
        quantity: item.quantity,
        price: item.price,
      })),
      totalAmount: order.totalAmount,
      status: order.status,
      statusText: this._statusText(order.status),
      createdAt: order.createdAt,
    };
  },

  /**
   * 订单列表项
   */
  toListItem(order) {
    return {
      id: order.id,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      status: order.status,
      statusText: this._statusText(order.status),
      createdAt: order.createdAt,
    };
  },

  _statusText(status) {
    const map = {
      pending: '待付款',
      paid: '已付款',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[status] || status;
  },
};

module.exports = { UserTransformer, ProductTransformer, OrderTransformer };
