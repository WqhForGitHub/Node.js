/**
 * 产品服务 (Product Service)
 *
 * 功能：
 * - 产品 CRUD
 * - 产品列表（分页、搜索）
 * - 库存管理（增减库存）
 * - 产品分类
 *
 * 数据存储：内存（Demo 用途）
 */

const http = require('http');
const {
  registerAndHeartbeat,
  successResponse,
  errorResponse,
  readBody,
  Router,
} = require('../common');

// ============================================================
// 配置
// ============================================================

const SERVICE_NAME = 'product-service';
const HOST = process.env.SERVICE_HOST || '127.0.0.1';
const PORT = process.env.PRODUCT_SERVICE_PORT || 3003;

// ============================================================
// 数据存储
// ============================================================

const products = new Map();
let productIdCounter = 1;

// 初始化示例数据
const demoProducts = [
  { name: 'MacBook Pro 14"', price: 14999, stock: 50, category: '电子产品', description: 'Apple M3 Pro 芯片笔记本电脑' },
  { name: 'iPhone 15 Pro', price: 8999, stock: 200, category: '电子产品', description: 'Apple A17 Pro 芯片智能手机' },
  { name: 'AirPods Pro 2', price: 1899, stock: 300, category: '电子产品', description: 'Apple 主动降噪无线耳机' },
  { name: '机械键盘 Cherry MX', price: 699, stock: 150, category: '外设', description: 'Cherry MX 红轴机械键盘' },
  { name: '4K 显示器 27寸', price: 2599, stock: 80, category: '外设', description: '4K IPS 面板专业显示器' },
  { name: '人体工学椅', price: 1299, stock: 60, category: '办公家具', description: '可调节腰托人体工学座椅' },
  { name: '程序员保温杯', price: 99, stock: 500, category: '生活用品', description: '316不锈钢真空保温杯' },
  { name: '降噪耳罩', price: 399, stock: 120, category: '外设', description: '专业录音级降噪耳罩' },
];

demoProducts.forEach((p) => {
  const id = `p${String(productIdCounter++).padStart(3, '0')}`;
  products.set(id, {
    id,
    name: p.name,
    price: p.price,
    stock: p.stock,
    category: p.category,
    description: p.description,
    createdAt: Date.now() - Math.floor(Math.random() * 604800000),
    updatedAt: null,
  });
});

// ============================================================
// 路由
// ============================================================

const router = new Router();

// POST /api/products - 创建产品
router.post('/api/products', async (req, res) => {
  const body = await readBody(req);
  const { name, price, stock, category, description } = body;

  if (!name || price === undefined || stock === undefined) {
    return errorResponse(res, 'name, price, stock 必填');
  }

  if (price < 0 || stock < 0) {
    return errorResponse(res, '价格和库存不能为负数');
  }

  const id = `p${String(productIdCounter++).padStart(3, '0')}`;
  const product = {
    id,
    name,
    price: Number(price),
    stock: Number(stock),
    category: category || '未分类',
    description: description || '',
    createdAt: Date.now(),
    updatedAt: null,
  };
  products.set(id, product);

  successResponse(res, { message: '产品创建成功', product }, 201);
});

// GET /api/products - 产品列表（支持搜索、分类过滤、分页）
router.get('/api/products', async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const keyword = url.searchParams.get('keyword') || '';
  const category = url.searchParams.get('category') || '';
  const minPrice = parseFloat(url.searchParams.get('minPrice')) || 0;
  const maxPrice = parseFloat(url.searchParams.get('maxPrice')) || Infinity;
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 10;
  const sort = url.searchParams.get('sort') || 'createdAt'; // createdAt | price | name
  const order = url.searchParams.get('order') || 'desc';    // asc | desc

  let filtered = Array.from(products.values());

  // 关键词搜索
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)
    );
  }

  // 分类过滤
  if (category) {
    filtered = filtered.filter((p) => p.category === category);
  }

  // 价格区间
  filtered = filtered.filter((p) => p.price >= minPrice && p.price <= maxPrice);

  // 排序
  filtered.sort((a, b) => {
    let va = a[sort], vb = b[sort];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return order === 'asc' ? -1 : 1;
    if (va > vb) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  // 获取所有分类
  const categories = [...new Set(Array.from(products.values()).map((p) => p.category))];

  successResponse(res, {
    products: paged,
    categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/products/:id - 产品详情
router.get('/api/products/:id', async (req, res, params) => {
  const product = products.get(params.id);
  if (!product) {
    return errorResponse(res, '产品不存在', 404);
  }
  successResponse(res, { product });
});

// PUT /api/products/:id - 更新产品
router.put('/api/products/:id', async (req, res, params) => {
  const product = products.get(params.id);
  if (!product) {
    return errorResponse(res, '产品不存在', 404);
  }

  const body = await readBody(req);
  if (body.name !== undefined) product.name = body.name;
  if (body.price !== undefined) product.price = Number(body.price);
  if (body.category !== undefined) product.category = body.category;
  if (body.description !== undefined) product.description = body.description;
  product.updatedAt = Date.now();

  successResponse(res, { message: '更新成功', product });
});

// PUT /api/products/:id/stock - 库存变动（增加/减少）
router.put('/api/products/:id/stock', async (req, res, params) => {
  const product = products.get(params.id);
  if (!product) {
    return errorResponse(res, '产品不存在', 404);
  }

  const body = await readBody(req);
  const { quantity } = body;

  if (quantity === undefined || quantity === 0) {
    return errorResponse(res, 'quantity 必填且不能为 0');
  }

  const newStock = product.stock + quantity;
  if (newStock < 0) {
    return errorResponse(res, `库存不足，当前: ${product.stock}，尝试扣减: ${Math.abs(quantity)}`, 409);
  }

  product.stock = newStock;
  product.updatedAt = Date.now();

  const action = quantity > 0 ? '入库' : '出库';
  successResponse(res, {
    message: `${action}成功`,
    product,
    stockChange: quantity,
  });
});

// DELETE /api/products/:id - 删除产品
router.delete('/api/products/:id', async (req, res, params) => {
  const product = products.get(params.id);
  if (!product) {
    return errorResponse(res, '产品不存在', 404);
  }

  products.delete(params.id);
  successResponse(res, { message: '删除成功' });
});

// GET /api/products/categories/list - 分类列表
router.get('/api/products/categories/list', async (req, res) => {
  const categoryMap = {};
  for (const product of products.values()) {
    if (!categoryMap[product.category]) {
      categoryMap[product.category] = { count: 0, products: [] };
    }
    categoryMap[product.category].count++;
    categoryMap[product.category].products.push(product.name);
  }
  successResponse(res, { categories: categoryMap });
});

// GET /health - 健康检查
router.get('/health', async (req, res) => {
  successResponse(res, {
    status: 'healthy',
    service: SERVICE_NAME,
    host: HOST,
    port: PORT,
    uptime: process.uptime(),
    productCount: products.size,
    totalStock: Array.from(products.values()).reduce((sum, p) => sum + p.stock, 0),
  });
});

// ============================================================
// 启动服务
// ============================================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const handled = await router.handle(req, res);
  if (!handled) {
    errorResponse(res, '路由未找到', 404);
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`[ProductService] 产品服务已启动: http://${HOST}:${PORT}`);

  try {
    const registration = await registerAndHeartbeat({
      name: SERVICE_NAME,
      host: HOST,
      port: PORT,
      metadata: { version: '1.0.0', description: '产品管理服务' },
    });

    process.on('SIGINT', async () => {
      console.log(`\n[${SERVICE_NAME}] 正在关闭...`);
      await registration.deregister();
      server.close(() => {
        console.log(`[${SERVICE_NAME}] 已关闭`);
        process.exit(0);
      });
    });
  } catch (err) {
    console.error(`[ProductService] 注册失败: ${err.message}`);
  }
});
