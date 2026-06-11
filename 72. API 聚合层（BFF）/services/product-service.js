/**
 * 商品服务 (Product Service)
 *
 * 模拟后端微服务 - 商品管理
 * 端口: 5003
 */

const http = require('http');

const PORT = process.env.PRODUCT_SERVICE_PORT || 5003;

// 模拟商品数据库
const products = {
  'p001': { id: 'p001', name: '智能手机 Pro Max', category: 'electronics', price: 2999, originalPrice: 3999, description: '旗舰级智能手机，支持5G网络，超强拍照', images: ['/img/p001_1.jpg', '/img/p001_2.jpg'], specs: { screen: '6.7英寸', cpu: 'A17 Pro', ram: '8GB', storage: '256GB', battery: '4500mAh' }, rating: 4.8, reviewCount: 1256, tags: ['热门', '新品', '5G'] },
  'p002': { id: 'p002', name: '轻薄笔记本 Air', category: 'electronics', price: 5999, originalPrice: 6999, description: '超轻薄设计，长续航，高性能办公', images: ['/img/p002_1.jpg', '/img/p002_2.jpg'], specs: { screen: '14英寸', cpu: 'M3', ram: '16GB', storage: '512GB', weight: '1.24kg' }, rating: 4.6, reviewCount: 832, tags: ['轻薄', '办公', '长续航'] },
  'p003': { id: 'p003', name: '无线蓝牙耳机', category: 'audio', price: 199, originalPrice: 299, description: '主动降噪，高清音质，30小时续航', images: ['/img/p003_1.jpg'], specs: { driver: '11mm', battery: '30小时', noise: 'ANC主动降噪', connect: '蓝牙5.3' }, rating: 4.5, reviewCount: 3421, tags: ['降噪', '热销'] },
  'p004': { id: 'p004', name: '手机保护壳', category: 'accessories', price: 99, originalPrice: 129, description: '防摔防震，轻薄透明设计', images: ['/img/p004_1.jpg'], specs: { material: 'TPU+PC', weight: '30g', compatible: '智能手机 Pro Max' }, rating: 4.2, reviewCount: 5678, tags: ['配件', '防摔'] },
  'p005': { id: 'p005', name: '便携充电宝', category: 'accessories', price: 399, originalPrice: 499, description: '20000mAh大容量，支持65W快充', images: ['/img/p005_1.jpg'], specs: { capacity: '20000mAh', output: '65W', ports: 'USB-C x2, USB-A x1', weight: '350g' }, rating: 4.4, reviewCount: 2190, tags: ['快充', '便携'] },
  'p006': { id: 'p006', name: '智能手表 GT', category: 'wearable', price: 1299, originalPrice: 1599, description: '健康监测，运动追踪，14天续航', images: ['/img/p006_1.jpg', '/img/p006_2.jpg'], specs: { screen: '1.43英寸AMOLED', battery: '14天', waterproof: '5ATM', sensors: '心率/血氧/睡眠' }, rating: 4.7, reviewCount: 1890, tags: ['健康', '运动', '长续航'] },
};

// 商品分类
const categories = [
  { id: 'electronics', name: '数码电子', icon: '💻' },
  { id: 'audio', name: '音频设备', icon: '🎧' },
  { id: 'accessories', name: '配件周边', icon: '🔌' },
  { id: 'wearable', name: '智能穿戴', icon: '⌚' },
];

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

  console.log(`[ProductService] ${method} ${path}`);

  // 健康检查
  if (method === 'GET' && path === '/health') {
    return json(res, 200, { status: 'healthy', service: 'product-service', uptime: process.uptime() });
  }

  // 获取商品分类
  if (method === 'GET' && path === '/products/categories') {
    return json(res, 200, { success: true, data: categories });
  }

  // 获取所有商品（支持分类筛选、搜索）
  if (method === 'GET' && path === '/products') {
    const category = url.searchParams.get('category');
    const keyword = url.searchParams.get('keyword');
    let result = Object.values(products);
    if (category) result = result.filter((p) => p.category === category);
    if (keyword) result = result.filter((p) => p.name.includes(keyword) || p.description.includes(keyword));
    return json(res, 200, { success: true, data: result, total: result.length });
  }

  // 获取单个商品详情
  if (method === 'GET' && path.startsWith('/products/') && path !== '/products/categories') {
    const productId = path.split('/')[2];
    const product = products[productId];
    if (!product) return json(res, 404, { success: false, error: '商品不存在' });
    return json(res, 200, { success: true, data: product });
  }

  // 批量获取商品信息
  if (method === 'POST' && path === '/products/batch') {
    const body = await parseBody(req);
    const ids = body.ids || [];
    const result = ids.map((id) => products[id]).filter(Boolean);
    return json(res, 200, { success: true, data: result });
  }

  json(res, 404, { success: false, error: '路由未找到' });
});

server.listen(PORT, () => {
  console.log(`[ProductService] 商品服务已启动: http://127.0.0.1:${PORT}`);
});
