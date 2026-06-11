/**
 * 用户服务 (User Service)
 *
 * 模拟后端微服务 - 用户管理
 * 端口: 5001
 */

const http = require('http');

const PORT = process.env.USER_SERVICE_PORT || 5001;

// 模拟用户数据库
const users = {
  'u001': { id: 'u001', name: '张三', email: 'zhangsan@example.com', avatar: '/avatars/u001.png', level: 'gold', phone: '138****1234', address: '北京市朝阳区xxx路', registeredAt: '2024-01-15T08:30:00Z' },
  'u002': { id: 'u002', name: '李四', email: 'lisi@example.com', avatar: '/avatars/u002.png', level: 'silver', phone: '139****5678', address: '上海市浦东新区xxx街', registeredAt: '2024-03-20T14:15:00Z' },
  'u003': { id: 'u003', name: '王五', email: 'wangwu@example.com', avatar: '/avatars/u003.png', level: 'platinum', phone: '137****9012', address: '广州市天河区xxx道', registeredAt: '2023-11-05T09:45:00Z' },
  'u004': { id: 'u004', name: '赵六', email: 'zhaoliu@example.com', avatar: '/avatars/u004.png', level: 'gold', phone: '136****3456', address: '深圳市南山区xxx巷', registeredAt: '2024-06-10T16:20:00Z' },
};

// 模拟用户偏好设置
const preferences = {
  'u001': { language: 'zh-CN', theme: 'dark', notifications: { email: true, sms: false, push: true } },
  'u002': { language: 'zh-CN', theme: 'light', notifications: { email: true, sms: true, push: false } },
  'u003': { language: 'en', theme: 'dark', notifications: { email: false, sms: false, push: true } },
  'u004': { language: 'zh-CN', theme: 'auto', notifications: { email: true, sms: true, push: true } },
};

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`[UserService] ${method} ${path}`);

  // 健康检查
  if (method === 'GET' && path === '/health') {
    return json(res, 200, { status: 'healthy', service: 'user-service', uptime: process.uptime() });
  }

  // 获取所有用户列表
  if (method === 'GET' && path === '/users') {
    const list = Object.values(users).map(({ id, name, level, avatar }) => ({ id, name, level, avatar }));
    return json(res, 200, { success: true, data: list, total: list.length });
  }

  // 获取单个用户详情
  if (method === 'GET' && path.startsWith('/users/')) {
    const userId = path.split('/')[2];
    const user = users[userId];
    if (!user) return json(res, 404, { success: false, error: '用户不存在' });
    return json(res, 200, { success: true, data: user });
  }

  // 获取用户偏好设置
  if (method === 'GET' && path.match(/^\/users\/u\d+\/preferences$/)) {
    const userId = path.split('/')[2];
    const pref = preferences[userId];
    if (!pref) return json(res, 404, { success: false, error: '偏好设置不存在' });
    return json(res, 200, { success: true, data: pref });
  }

  // 批量获取用户信息
  if (method === 'POST' && path === '/users/batch') {
    const body = await parseBody(req);
    const ids = body.ids || [];
    const result = ids.map((id) => users[id]).filter(Boolean);
    return json(res, 200, { success: true, data: result });
  }

  // 更新用户信息
  if (method === 'PUT' && path.startsWith('/users/')) {
    const userId = path.split('/')[2];
    if (!users[userId]) return json(res, 404, { success: false, error: '用户不存在' });
    const body = await parseBody(req);
    Object.assign(users[userId], body);
    return json(res, 200, { success: true, data: users[userId] });
  }

  json(res, 404, { success: false, error: '路由未找到' });
});

server.listen(PORT, () => {
  console.log(`[UserService] 用户服务已启动: http://127.0.0.1:${PORT}`);
});
