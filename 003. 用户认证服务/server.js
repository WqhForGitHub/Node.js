const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── 配置 ──────────────────────────────────────────────
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// JWT 配置
const JWT_SECRET = 'demo-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRES = '15m'; // 访问令牌有效期 15 分钟
const REFRESH_TOKEN_EXPIRES = '7d'; // 刷新令牌有效期 7 天

// 密码哈希配置
const HASH_ALGORITHM = 'sha512';
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

// ─── 数据层 ──────────────────────────────────────────────

/** 确保数据文件存在 */
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
}

/** 读取所有用户 */
function readUsers() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

/** 写入所有用户 */
function writeUsers(users) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// ─── 密码工具 ──────────────────────────────────────────────

/** 生成随机盐值 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString('hex');
}

/** 对密码进行哈希 (PBKDF2) */
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, HASH_ALGORITHM).toString('hex');
}

/** 验证密码 */
function verifyPassword(password, salt, hashedPassword) {
  return hashPassword(password, salt) === hashedPassword;
}

// ─── JWT 工具 ──────────────────────────────────────────────

/** 解析时间字符串为秒数 */
function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)(m|h|d)$/);
  if (!match) return 900; // 默认 15 分钟
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return 900;
  }
}

/** Base64URL 编码 */
function base64UrlEncode(data) {
  return Buffer.from(JSON.stringify(data))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Base64URL 解码 */
function base64UrlDecode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}

/** 生成 JWT */
function generateJwt(payload, expiresIn) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiry(expiresIn);

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode({ ...payload, iat: now, exp });
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/** 验证 JWT，返回解码后的 payload 或 null */
function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) return null;

    // 解码 payload
    const payload = base64UrlDecode(encodedPayload);

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── 通用工具函数 ──────────────────────────────────────────────

/** 生成唯一 ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 解析请求体为 JSON */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('无效的 JSON 格式'));
      }
    });
    req.on('error', reject);
  });
}

/** 发送 JSON 响应 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

/** 从请求头中提取 Bearer Token */
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/** 从 URL 中提取路由参数 */
function parsePath(url) {
  const pathname = url.split('?')[0];
  const segments = pathname.replace(/^\/|\/$/g, '').split('/');
  return { segments };
}

/** 验证邮箱格式 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── 令牌存储（刷新令牌） ──────────────────────────────────────

// 简单的内存存储，生产环境应使用 Redis 或数据库
const refreshTokens = new Map(); // userId -> Set<{ token, expiresAt }>

/** 存储刷新令牌 */
function storeRefreshToken(userId, token) {
  if (!refreshTokens.has(userId)) {
    refreshTokens.set(userId, new Set());
  }
  const expiresAt = Date.now() + parseExpiry(REFRESH_TOKEN_EXPIRES) * 1000;
  refreshTokens.get(userId).add({ token, expiresAt });
}

/** 验证刷新令牌 */
function isValidRefreshToken(userId, token) {
  const tokens = refreshTokens.get(userId);
  if (!tokens) return false;
  for (const entry of tokens) {
    if (entry.token === token && entry.expiresAt > Date.now()) {
      return true;
    }
  }
  return false;
}

/** 撤销刷新令牌 */
function revokeRefreshToken(userId, token) {
  const tokens = refreshTokens.get(userId);
  if (!tokens) return;
  for (const entry of tokens) {
    if (entry.token === token) {
      tokens.delete(entry);
      break;
    }
  }
}

/** 撤销用户所有刷新令牌 */
function revokeAllRefreshTokens(userId) {
  refreshTokens.delete(userId);
}

// ─── 路由处理器 ──────────────────────────────────────────────

/** POST /api/auth/register — 用户注册 */
async function handleRegister(req, res) {
  const body = await parseBody(req);

  // 参数校验
  if (!body.username || typeof body.username !== 'string' || !body.username.trim()) {
    return sendJson(res, 400, { success: false, error: 'username 为必填字段' });
  }
  if (!body.email || typeof body.email !== 'string' || !isValidEmail(body.email)) {
    return sendJson(res, 400, { success: false, error: 'email 格式不正确' });
  }
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    return sendJson(res, 400, {
      success: false,
      error: 'password 至少需要 6 个字符',
    });
  }

  const users = readUsers();

  // 检查用户名是否已存在
  if (users.find((u) => u.username === body.username.trim())) {
    return sendJson(res, 409, { success: false, error: '用户名已被注册' });
  }

  // 检查邮箱是否已存在
  if (users.find((u) => u.email === body.email.trim().toLowerCase())) {
    return sendJson(res, 409, { success: false, error: '邮箱已被注册' });
  }

  // 创建用户
  const salt = generateSalt();
  const hashedPwd = hashPassword(body.password, salt);
  const now = new Date().toISOString();

  const user = {
    id: generateId(),
    username: body.username.trim(),
    email: body.email.trim().toLowerCase(),
    password: `${salt}:${hashedPwd}`, // 格式: salt:hash
    nickname: body.nickname || body.username.trim(),
    avatar: null,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  writeUsers(users);

  // 生成令牌
  const accessToken = generateJwt(
    { userId: user.id, username: user.username },
    ACCESS_TOKEN_EXPIRES
  );
  const refreshToken = crypto.randomBytes(40).toString('hex');
  storeRefreshToken(user.id, refreshToken);

  // 返回用户信息（不含密码）
  const { password: _, ...userWithoutPassword } = user;
  sendJson(res, 201, {
    success: true,
    data: {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
    },
  });
}

/** POST /api/auth/login — 用户登录 */
async function handleLogin(req, res) {
  const body = await parseBody(req);

  if (!body.username || !body.password) {
    return sendJson(res, 400, {
      success: false,
      error: 'username 和 password 为必填字段',
    });
  }

  const users = readUsers();
  const user = users.find((u) => u.username === body.username);

  if (!user) {
    return sendJson(res, 401, { success: false, error: '用户名或密码错误' });
  }

  // 验证密码
  const [salt, hashedPwd] = user.password.split(':');
  if (!verifyPassword(body.password, salt, hashedPwd)) {
    return sendJson(res, 401, { success: false, error: '用户名或密码错误' });
  }

  // 生成令牌
  const accessToken = generateJwt(
    { userId: user.id, username: user.username },
    ACCESS_TOKEN_EXPIRES
  );
  const refreshToken = crypto.randomBytes(40).toString('hex');
  storeRefreshToken(user.id, refreshToken);

  // 更新登录时间
  user.updatedAt = new Date().toISOString();
  writeUsers(users);

  const { password: _, ...userWithoutPassword } = user;
  sendJson(res, 200, {
    success: true,
    data: {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
    },
  });
}

/** POST /api/auth/refresh — 刷新访问令牌 */
async function handleRefresh(req, res) {
  const body = await parseBody(req);

  if (!body.refreshToken) {
    return sendJson(res, 400, {
      success: false,
      error: 'refreshToken 为必填字段',
    });
  }

  // 尝试从 accessToken 获取用户信息（即使过期也解析 userId）
  const oldAccessToken = extractBearerToken(req);
  let userId = null;

  if (oldAccessToken) {
    // 先正常验证
    const payload = verifyJwt(oldAccessToken);
    if (payload) {
      userId = payload.userId;
    } else {
      // 令牌过期，但仍可解码获取 userId（不验证签名）
      try {
        const parts = oldAccessToken.split('.');
        if (parts.length === 3) {
          const decoded = base64UrlDecode(parts[1]);
          userId = decoded.userId;
        }
      } catch {
        // 忽略
      }
    }
  }

  // 如果无法从 accessToken 获取 userId，则从 body 中获取
  if (!userId && body.userId) {
    userId = body.userId;
  }

  if (!userId) {
    return sendJson(res, 401, {
      success: false,
      error: '无法识别用户，请重新登录',
    });
  }

  // 验证刷新令牌
  if (!isValidRefreshToken(userId, body.refreshToken)) {
    return sendJson(res, 401, {
      success: false,
      error: '刷新令牌无效或已过期，请重新登录',
    });
  }

  // 获取用户信息
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return sendJson(res, 401, { success: false, error: '用户不存在' });
  }

  // 撤销旧的刷新令牌，生成新的刷新令牌（轮换策略）
  revokeRefreshToken(userId, body.refreshToken);

  const accessToken = generateJwt(
    { userId: user.id, username: user.username },
    ACCESS_TOKEN_EXPIRES
  );
  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  storeRefreshToken(user.id, newRefreshToken);

  sendJson(res, 200, {
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
    },
  });
}

/** POST /api/auth/logout — 用户登出 */
async function handleLogout(req, res) {
  const accessToken = extractBearerToken(req);
  const body = await parseBody(req);

  if (!accessToken) {
    return sendJson(res, 400, { success: false, error: '缺少访问令牌' });
  }

  const payload = verifyJwt(accessToken);
  if (!payload) {
    return sendJson(res, 401, {
      success: false,
      error: '访问令牌无效或已过期',
    });
  }

  // 撤销刷新令牌
  if (body.refreshToken) {
    revokeRefreshToken(payload.userId, body.refreshToken);
  } else {
    // 没有提供 refreshToken 则撤销所有刷新令牌
    revokeAllRefreshTokens(payload.userId);
  }

  sendJson(res, 200, { success: true, data: { message: '已成功登出' } });
}

/** GET /api/auth/profile — 获取当前用户信息 */
function handleGetProfile(req, res) {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return sendJson(res, 401, { success: false, error: '缺少访问令牌' });
  }

  const payload = verifyJwt(accessToken);
  if (!payload) {
    return sendJson(res, 401, {
      success: false,
      error: '访问令牌无效或已过期',
    });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === payload.userId);
  if (!user) {
    return sendJson(res, 404, { success: false, error: '用户不存在' });
  }

  const { password: _, ...userWithoutPassword } = user;
  sendJson(res, 200, { success: true, data: userWithoutPassword });
}

/** PUT /api/auth/profile — 更新当前用户信息 */
async function handleUpdateProfile(req, res) {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return sendJson(res, 401, { success: false, error: '缺少访问令牌' });
  }

  const payload = verifyJwt(accessToken);
  if (!payload) {
    return sendJson(res, 401, {
      success: false,
      error: '访问令牌无效或已过期',
    });
  }

  const body = await parseBody(req);
  const users = readUsers();
  const index = users.findIndex((u) => u.id === payload.userId);
  if (index === -1) {
    return sendJson(res, 404, { success: false, error: '用户不存在' });
  }

  const user = users[index];

  // 更新昵称
  if (body.nickname !== undefined) {
    if (typeof body.nickname !== 'string' || !body.nickname.trim()) {
      return sendJson(res, 400, { success: false, error: 'nickname 不能为空' });
    }
    user.nickname = body.nickname.trim();
  }

  // 更新邮箱
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) {
      return sendJson(res, 400, { success: false, error: 'email 格式不正确' });
    }
    const newEmail = body.email.trim().toLowerCase();
    if (newEmail !== user.email && users.find((u) => u.email === newEmail)) {
      return sendJson(res, 409, {
        success: false,
        error: '邮箱已被其他用户使用',
      });
    }
    user.email = newEmail;
  }

  // 更新头像
  if (body.avatar !== undefined) {
    user.avatar = body.avatar;
  }

  // 修改密码
  if (body.oldPassword && body.newPassword) {
    const [salt, hashedPwd] = user.password.split(':');
    if (!verifyPassword(body.oldPassword, salt, hashedPwd)) {
      return sendJson(res, 401, { success: false, error: '旧密码不正确' });
    }
    if (body.newPassword.length < 6) {
      return sendJson(res, 400, {
        success: false,
        error: '新密码至少需要 6 个字符',
      });
    }
    const newSalt = generateSalt();
    user.password = `${newSalt}:${hashPassword(body.newPassword, newSalt)}`;
    // 修改密码后撤销所有刷新令牌
    revokeAllRefreshTokens(user.id);
  }

  user.updatedAt = new Date().toISOString();
  users[index] = user;
  writeUsers(users);

  const { password: _, ...userWithoutPassword } = user;
  sendJson(res, 200, { success: true, data: userWithoutPassword });
}

/** POST /api/auth/change-password — 修改密码 */
async function handleChangePassword(req, res) {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return sendJson(res, 401, { success: false, error: '缺少访问令牌' });
  }

  const payload = verifyJwt(accessToken);
  if (!payload) {
    return sendJson(res, 401, {
      success: false,
      error: '访问令牌无效或已过期',
    });
  }

  const body = await parseBody(req);
  if (!body.oldPassword || !body.newPassword) {
    return sendJson(res, 400, {
      success: false,
      error: 'oldPassword 和 newPassword 为必填字段',
    });
  }
  if (body.newPassword.length < 6) {
    return sendJson(res, 400, {
      success: false,
      error: '新密码至少需要 6 个字符',
    });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === payload.userId);
  if (!user) {
    return sendJson(res, 404, { success: false, error: '用户不存在' });
  }

  const [salt, hashedPwd] = user.password.split(':');
  if (!verifyPassword(body.oldPassword, salt, hashedPwd)) {
    return sendJson(res, 401, { success: false, error: '旧密码不正确' });
  }

  const newSalt = generateSalt();
  user.password = `${newSalt}:${hashPassword(body.newPassword, newSalt)}`;
  user.updatedAt = new Date().toISOString();
  writeUsers(users);

  // 修改密码后撤销所有刷新令牌
  revokeAllRefreshTokens(user.id);

  sendJson(res, 200, { success: true, data: { message: '密码修改成功' } });
}

// ─── 请求路由 ──────────────────────────────────────────────

async function handleRequest(req, res) {
  const { segments } = parsePath(req.url);
  const method = req.method;

  // 路由匹配：/api/auth/*
  if (segments[0] === 'api' && segments[1] === 'auth') {
    try {
      const action = segments[2];

      // POST /api/auth/register
      if (method === 'POST' && action === 'register') {
        return await handleRegister(req, res);
      }
      // POST /api/auth/login
      if (method === 'POST' && action === 'login') {
        return await handleLogin(req, res);
      }
      // POST /api/auth/refresh
      if (method === 'POST' && action === 'refresh') {
        return await handleRefresh(req, res);
      }
      // POST /api/auth/logout
      if (method === 'POST' && action === 'logout') {
        return await handleLogout(req, res);
      }
      // GET /api/auth/profile
      if (method === 'GET' && action === 'profile') {
        return handleGetProfile(req, res);
      }
      // PUT /api/auth/profile
      if (method === 'PUT' && action === 'profile') {
        return await handleUpdateProfile(req, res);
      }
      // POST /api/auth/change-password
      if (method === 'POST' && action === 'change-password') {
        return await handleChangePassword(req, res);
      }

      // 方法或路由不允许
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, error: '接口未找到' }));
    } catch (err) {
      console.error('服务器错误:', err.message);
      return sendJson(res, 500, { success: false, error: '服务器内部错误' });
    }
  }

  // 404
  sendJson(res, 404, { success: false, error: '接口未找到' });
}

// ─── 启动服务器 ──────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🔐 用户认证服务已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   接口:`);
  console.log(`     POST   /api/auth/register        用户注册`);
  console.log(`     POST   /api/auth/login            用户登录`);
  console.log(`     POST   /api/auth/refresh          刷新令牌`);
  console.log(`     POST   /api/auth/logout           用户登出`);
  console.log(`     GET    /api/auth/profile          获取用户信息`);
  console.log(`     PUT    /api/auth/profile          更新用户信息`);
  console.log(`     POST   /api/auth/change-password  修改密码`);
});
