const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3034;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');
const PERMISSIONS_FILE = path.join(DATA_DIR, 'permissions.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

// ==================== 数据存储 ====================

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`读取 ${filePath} 失败:`, e.message);
  }
  return defaultVal;
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`写入 ${filePath} 失败:`, e.message);
  }
}

let users = loadData(USERS_FILE, []);
let roles = loadData(ROLES_FILE, {});
let permissions = loadData(PERMISSIONS_FILE, []);
const tokens = loadData(TOKENS_FILE, {});
let resources = loadData(RESOURCES_FILE, []);

function persist() {
  saveData(USERS_FILE, users);
  saveData(ROLES_FILE, roles);
  saveData(PERMISSIONS_FILE, permissions);
  saveData(TOKENS_FILE, tokens);
  saveData(RESOURCES_FILE, resources);
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  // 默认权限定义
  if (permissions.length === 0) {
    permissions = [
      { resource: 'article', action: 'read', description: '读取文章' },
      { resource: 'article', action: 'write', description: '编写文章' },
      { resource: 'article', action: 'delete', description: '删除文章' },
      { resource: 'article', action: 'publish', description: '发布文章' },
      { resource: 'user', action: 'read', description: '查看用户' },
      { resource: 'user', action: 'write', description: '编辑用户' },
      { resource: 'user', action: 'delete', description: '删除用户' },
      { resource: 'role', action: 'read', description: '查看角色' },
      { resource: 'role', action: 'write', description: '编辑角色' },
      { resource: 'role', action: 'delete', description: '删除角色' },
      { resource: 'permission', action: 'read', description: '查看权限' },
      { resource: 'permission', action: 'write', description: '编辑权限' },
      { resource: 'dashboard', action: 'read', description: '查看仪表盘' },
      { resource: 'settings', action: 'read', description: '查看设置' },
      { resource: 'settings', action: 'write', description: '修改设置' },
    ];
  }

  // 默认角色
  if (Object.keys(roles).length === 0) {
    roles = {
      admin: {
        name: 'admin',
        description: '超级管理员，拥有所有权限',
        permissions: permissions.map((p) => `${p.resource}:${p.action}`),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: true,
      },
      editor: {
        name: 'editor',
        description: '编辑者，可管理文章',
        permissions: [
          'article:read',
          'article:write',
          'article:delete',
          'article:publish',
          'user:read',
          'role:read',
          'permission:read',
          'dashboard:read',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: false,
      },
      viewer: {
        name: 'viewer',
        description: '查看者，只读权限',
        permissions: [
          'article:read',
          'user:read',
          'role:read',
          'permission:read',
          'dashboard:read',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: false,
      },
    };
  }

  // 默认管理员用户
  if (users.length === 0) {
    users.push({
      id: crypto.randomUUID(),
      username: 'admin',
      password: hashPassword('admin123'),
      roles: ['admin'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    users.push({
      id: crypto.randomUUID(),
      username: 'editor',
      password: hashPassword('editor123'),
      roles: ['editor'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    users.push({
      id: crypto.randomUUID(),
      username: 'viewer',
      password: hashPassword('viewer123'),
      roles: ['viewer'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // 默认资源数据
  if (resources.length === 0) {
    resources = [
      {
        id: crypto.randomUUID(),
        type: 'article',
        title: 'RBAC 权限系统介绍',
        content: '本文介绍基于角色的访问控制系统...',
        author: 'admin',
        status: 'published',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        type: 'article',
        title: 'Node.js 最佳实践',
        content: 'Node.js 开发中的最佳实践总结...',
        author: 'editor',
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  persist();
}

// ==================== 工具函数 ====================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function sendSuccess(res, data, extra = {}) {
  send(res, 200, { success: true, data, ...extra });
}

function sendError(res, statusCode, error) {
  send(res, statusCode, { success: false, error });
}

function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password + 'rbac_salt_2024')
    .digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== RBAC 核心引擎 ====================

// 获取用户的所有权限（通过角色聚合）
function getUserPermissions(user) {
  const permSet = new Set();
  for (const roleName of user.roles) {
    const role = roles[roleName];
    if (role) {
      for (const perm of role.permissions) {
        permSet.add(perm);
      }
    }
  }
  return [...permSet];
}

// 检查用户是否拥有指定权限
function hasPermission(user, permission) {
  const userPerms = getUserPermissions(user);
  // 支持通配符: "article:*" 匹配所有 article 的操作
  return userPerms.some((p) => {
    if (p === permission) return true;
    const [res, act] = permission.split(':');
    const [pRes, pAct] = p.split(':');
    if (pRes === res && pAct === '*') return true;
    if (pRes === '*' && pAct === '*') return true;
    return false;
  });
}

// 批量检查权限
function checkPermissions(user, requiredPermissions) {
  const userPerms = getUserPermissions(user);
  const results = {};
  for (const perm of requiredPermissions) {
    results[perm] = userPerms.some((p) => {
      if (p === perm) return true;
      const [res, act] = perm.split(':');
      const [pRes, pAct] = p.split(':');
      if (pRes === res && pAct === '*') return true;
      if (pRes === '*' && pAct === '*') return true;
      return false;
    });
  }
  return results;
}

// 获取用户信息（脱敏）
function sanitizeUser(user) {
  const { password, ...rest } = user;
  return {
    ...rest,
    permissions: getUserPermissions(user),
  };
}

// ==================== 认证中间件 ====================

function getTokenFromHeader(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function authenticate(req) {
  const token = getTokenFromHeader(req);
  if (!token) return null;

  const tokenData = tokens[token];
  if (!tokenData) return null;

  // 检查 token 是否过期
  if (Date.now() - tokenData.createdAt > TOKEN_EXPIRY) {
    delete tokens[token];
    return null;
  }

  const user = users.find((u) => u.id === tokenData.userId && u.isActive);
  return user || null;
}

// 要求认证的中间件
function requireAuth(handler) {
  return async (req, res, ...args) => {
    const user = authenticate(req);
    if (!user) {
      return sendError(res, 401, '未认证，请先登录');
    }
    return handler(req, res, user, ...args);
  };
}

// 要求指定权限的中间件
function requirePermission(permission) {
  return (handler) => {
    return requireAuth(async (req, res, user, ...args) => {
      if (!hasPermission(user, permission)) {
        return sendError(res, 403, `权限不足，需要权限: ${permission}`);
      }
      return handler(req, res, user, ...args);
    });
  };
}

// 要求任意一个权限的中间件
function requireAnyPermission(...perms) {
  return (handler) => {
    return requireAuth(async (req, res, user, ...args) => {
      const hasAny = perms.some((p) => hasPermission(user, p));
      if (!hasAny) {
        return sendError(res, 403, `权限不足，需要以下任一权限: ${perms.join(', ')}`);
      }
      return handler(req, res, user, ...args);
    });
  };
}

// ==================== Auth API ====================

// POST /api/auth/register - 注册用户
async function register(req, res) {
  const body = await parseBody(req);
  const { username, password, roles: roleNames } = body;

  if (!username || !password) {
    return sendError(res, 400, '缺少必填字段: username, password');
  }

  if (username.length < 3 || username.length > 20) {
    return sendError(res, 400, '用户名长度应为3-20个字符');
  }

  if (password.length < 6) {
    return sendError(res, 400, '密码长度至少6个字符');
  }

  if (users.find((u) => u.username === username)) {
    return sendError(res, 409, '用户名已存在');
  }

  // 验证角色存在
  const assignedRoles = roleNames || ['viewer'];
  for (const r of assignedRoles) {
    if (!roles[r]) {
      return sendError(res, 400, `角色不存在: ${r}`);
    }
  }

  const user = {
    id: crypto.randomUUID(),
    username: username.trim(),
    password: hashPassword(password),
    roles: assignedRoles,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  persist();

  send(res, 201, { success: true, data: sanitizeUser(user) });
}

// POST /api/auth/login - 登录
async function login(req, res) {
  const body = await parseBody(req);
  const { username, password } = body;

  if (!username || !password) {
    return sendError(res, 400, '缺少必填字段: username, password');
  }

  const user = users.find((u) => u.username === username && u.password === hashPassword(password));

  if (!user) {
    return sendError(res, 401, '用户名或密码错误');
  }

  if (!user.isActive) {
    return sendError(res, 403, '账号已被禁用');
  }

  // 生成 token
  const token = generateToken();
  tokens[token] = {
    userId: user.id,
    createdAt: Date.now(),
  };

  // 清理该用户的旧 token（每个用户最多保留5个 token）
  const userTokens = Object.entries(tokens)
    .filter(([, v]) => v.userId === user.id)
    .sort((a, b) => b[1].createdAt - a[1].createdAt);
  if (userTokens.length > 5) {
    for (let i = 5; i < userTokens.length; i++) {
      delete tokens[userTokens[i][0]];
    }
  }

  persist();

  sendSuccess(res, {
    token,
    user: sanitizeUser(user),
  });
}

// POST /api/auth/logout - 登出
async function logout(req, res, user) {
  const token = getTokenFromHeader(req);
  if (token && tokens[token]) {
    delete tokens[token];
    persist();
  }
  sendSuccess(res, { message: '已登出' });
}

// GET /api/auth/me - 获取当前用户信息
function getMe(req, res, user) {
  sendSuccess(res, sanitizeUser(user));
}

// GET /api/auth/permissions - 获取当前用户的权限详情
function getMyPermissions(req, res, user) {
  const perms = getUserPermissions(user);
  const roleDetails = user.roles
    .map((r) => roles[r])
    .filter(Boolean)
    .map((r) => ({
      name: r.name,
      description: r.description,
      permissions: r.permissions,
    }));

  sendSuccess(res, {
    user: { id: user.id, username: user.username },
    roles: roleDetails,
    permissions: perms,
  });
}

// POST /api/auth/check-permission - 检查当前用户是否拥有指定权限
async function checkPermission(req, res, user) {
  const body = await parseBody(req);
  const { permissions: requiredPerms } = body;

  if (!requiredPerms || !Array.isArray(requiredPerms) || requiredPerms.length === 0) {
    return sendError(res, 400, '缺少必填字段: permissions (数组)');
  }

  const results = checkPermissions(user, requiredPerms);
  const allGranted = Object.values(results).every(Boolean);

  sendSuccess(res, {
    allGranted,
    results,
  });
}

// ==================== 用户管理 API ====================

// GET /api/users - 获取用户列表
function getUsers(req, res, user) {
  const parsedUrl = url.parse(req.url, true);
  const { page = '1', limit = '20', search } = parsedUrl.query;

  let filtered = users.map(sanitizeUser);

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((u) => u.username.toLowerCase().includes(s));
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const start = (pageNum - 1) * limitNum;
  const paged = filtered.slice(start, start + limitNum);

  sendSuccess(res, paged, {
    total: filtered.length,
    page: pageNum,
    limit: limitNum,
  });
}

// GET /api/users/:id - 获取单个用户
function getUser(req, res, user, id) {
  const target = users.find((u) => u.id === id);
  if (!target) {
    return sendError(res, 404, '用户不存在');
  }
  sendSuccess(res, sanitizeUser(target));
}

// PUT /api/users/:id - 更新用户（分配角色、启用/禁用）
async function updateUser(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) {
    return sendError(res, 404, '用户不存在');
  }

  const body = await parseBody(req);
  const { roles: newRoles, isActive } = body;

  // 不允许修改自己的角色
  if (target.id === currentUser.id && newRoles) {
    return sendError(res, 403, '不能修改自己的角色');
  }

  // 不允许禁用自己
  if (target.id === currentUser.id && isActive === false) {
    return sendError(res, 403, '不能禁用自己');
  }

  if (newRoles !== undefined) {
    if (!Array.isArray(newRoles)) {
      return sendError(res, 400, 'roles 必须是数组');
    }
    for (const r of newRoles) {
      if (!roles[r]) {
        return sendError(res, 400, `角色不存在: ${r}`);
      }
    }
    target.roles = newRoles;
  }

  if (isActive !== undefined) {
    target.isActive = Boolean(isActive);
  }

  target.updatedAt = new Date().toISOString();
  persist();

  sendSuccess(res, sanitizeUser(target));
}

// DELETE /api/users/:id - 删除用户
function deleteUser(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) {
    return sendError(res, 404, '用户不存在');
  }

  if (target.id === currentUser.id) {
    return sendError(res, 403, '不能删除自己');
  }

  users = users.filter((u) => u.id !== id);

  // 清理该用户的 token
  for (const [token, data] of Object.entries(tokens)) {
    if (data.userId === id) {
      delete tokens[token];
    }
  }

  persist();
  sendSuccess(res, { message: '用户已删除' });
}

// PUT /api/users/:id/password - 修改密码
async function changePassword(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) {
    return sendError(res, 404, '用户不存在');
  }

  // 只能修改自己的密码，或管理员可以修改任何人的密码
  if (target.id !== currentUser.id && !hasPermission(currentUser, 'user:write')) {
    return sendError(res, 403, '权限不足');
  }

  const body = await parseBody(req);
  const { oldPassword, newPassword } = body;

  // 修改自己的密码需要验证旧密码
  if (target.id === currentUser.id) {
    if (!oldPassword) {
      return sendError(res, 400, '缺少必填字段: oldPassword');
    }
    if (target.password !== hashPassword(oldPassword)) {
      return sendError(res, 401, '旧密码错误');
    }
  }

  if (!newPassword || newPassword.length < 6) {
    return sendError(res, 400, '新密码长度至少6个字符');
  }

  target.password = hashPassword(newPassword);
  target.updatedAt = new Date().toISOString();

  // 清除该用户的所有 token（强制重新登录）
  for (const [token, data] of Object.entries(tokens)) {
    if (data.userId === id) {
      delete tokens[token];
    }
  }

  persist();
  sendSuccess(res, { message: '密码已修改，请重新登录' });
}

// ==================== 角色管理 API ====================

// GET /api/roles - 获取角色列表
function getRoles(req, res) {
  const roleList = Object.values(roles).map((r) => ({
    ...r,
    userCount: users.filter((u) => u.roles.includes(r.name)).length,
  }));
  sendSuccess(res, roleList);
}

// GET /api/roles/:name - 获取角色详情
function getRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) {
    return sendError(res, 404, '角色不存在');
  }

  const usersWithRole = users.filter((u) => u.roles.includes(name)).map(sanitizeUser);

  sendSuccess(res, {
    ...role,
    users: usersWithRole,
    userCount: usersWithRole.length,
  });
}

// POST /api/roles - 创建角色
async function createRole(req, res) {
  const body = await parseBody(req);
  const { name, description, permissions: rolePerms } = body;

  if (!name) {
    return sendError(res, 400, '缺少必填字段: name');
  }

  if (roles[name]) {
    return sendError(res, 409, '角色已存在');
  }

  if (!/^[a-z][a-z0-9_]{1,29}$/.test(name)) {
    return sendError(res, 400, '角色名只能包含小写字母、数字和下划线，2-30个字符，以字母开头');
  }

  const validatedPerms = (rolePerms || []).filter((p) => {
    const [res, act] = p.split(':');
    return permissions.some((perm) => perm.resource === res && perm.action === act);
  });

  const role = {
    name,
    description: description || '',
    permissions: validatedPerms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSystem: false,
  };

  roles[name] = role;
  persist();

  send(res, 201, { success: true, data: role });
}

// PUT /api/roles/:name - 更新角色
async function updateRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) {
    return sendError(res, 404, '角色不存在');
  }

  const body = await parseBody(req);
  const { description, permissions: rolePerms, addPermissions, removePermissions } = body;

  if (description !== undefined) {
    role.description = description;
  }

  // 直接设置权限
  if (rolePerms !== undefined) {
    if (!Array.isArray(rolePerms)) {
      return sendError(res, 400, 'permissions 必须是数组');
    }
    const validatedPerms = rolePerms.filter((p) => {
      const [r, a] = p.split(':');
      return permissions.some((perm) => perm.resource === r && perm.action === a);
    });
    role.permissions = validatedPerms;
  }

  // 增量添加权限
  if (addPermissions !== undefined) {
    if (!Array.isArray(addPermissions)) {
      return sendError(res, 400, 'addPermissions 必须是数组');
    }
    for (const p of addPermissions) {
      const [r, a] = p.split(':');
      if (permissions.some((perm) => perm.resource === r && perm.action === a)) {
        if (!role.permissions.includes(p)) {
          role.permissions.push(p);
        }
      }
    }
  }

  // 增量移除权限
  if (removePermissions !== undefined) {
    if (!Array.isArray(removePermissions)) {
      return sendError(res, 400, 'removePermissions 必须是数组');
    }
    role.permissions = role.permissions.filter((p) => !removePermissions.includes(p));
  }

  role.updatedAt = new Date().toISOString();
  persist();

  sendSuccess(res, role);
}

// DELETE /api/roles/:name - 删除角色
function deleteRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) {
    return sendError(res, 404, '角色不存在');
  }

  if (role.isSystem) {
    return sendError(res, 403, '系统内置角色不可删除');
  }

  // 检查是否有用户正在使用该角色
  const usersWithRole = users.filter((u) => u.roles.includes(name));
  if (usersWithRole.length > 0) {
    return sendError(res, 409, `该角色正在被 ${usersWithRole.length} 个用户使用，无法删除`);
  }

  delete roles[name];
  persist();

  sendSuccess(res, { message: '角色已删除' });
}

// ==================== 权限管理 API ====================

// GET /api/permissions - 获取所有权限
function getPermissions(req, res) {
  // 按资源分组
  const grouped = {};
  for (const p of permissions) {
    if (!grouped[p.resource]) {
      grouped[p.resource] = [];
    }
    grouped[p.resource].push(p);
  }

  sendSuccess(res, {
    list: permissions,
    grouped,
    total: permissions.length,
  });
}

// POST /api/permissions - 注册新权限
async function createPermission(req, res) {
  const body = await parseBody(req);
  const { resource, action, description } = body;

  if (!resource || !action) {
    return sendError(res, 400, '缺少必填字段: resource, action');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(resource)) {
    return sendError(res, 400, 'resource 只能包含小写字母、数字和下划线，以字母开头');
  }

  if (!/^[a-z][a-z0-9_]*$/.test(action)) {
    return sendError(res, 400, 'action 只能包含小写字母、数字和下划线，以字母开头');
  }

  const permKey = `${resource}:${action}`;
  if (permissions.find((p) => p.resource === resource && p.action === action)) {
    return sendError(res, 409, '权限已存在');
  }

  const perm = {
    resource,
    action,
    description: description || `${resource}:${action}`,
  };

  permissions.push(perm);
  persist();

  send(res, 201, { success: true, data: perm });
}

// DELETE /api/permissions/:resource/:action - 删除权限
function deletePermission(req, res, _user, resource, action) {
  const idx = permissions.findIndex((p) => p.resource === resource && p.action === action);
  if (idx === -1) {
    return sendError(res, 404, '权限不存在');
  }

  const permKey = `${resource}:${action}`;

  // 从所有角色中移除该权限
  for (const role of Object.values(roles)) {
    role.permissions = role.permissions.filter((p) => p !== permKey);
  }

  permissions.splice(idx, 1);
  persist();

  sendSuccess(res, { message: '权限已删除，已从所有角色中移除' });
}

// ==================== 受保护的资源 API（演示权限检查） ====================

// GET /api/resources/articles - 获取文章列表
function getArticles(req, res, user) {
  const parsedUrl = url.parse(req.url, true);
  const { status } = parsedUrl.query;

  let filtered = resources.filter((r) => r.type === 'article');
  if (status) {
    filtered = filtered.filter((r) => r.status === status);
  }

  sendSuccess(res, filtered, { total: filtered.length });
}

// POST /api/resources/articles - 创建文章
async function createArticle(req, res, user) {
  const body = await parseBody(req);
  const { title, content } = body;

  if (!title || !content) {
    return sendError(res, 400, '缺少必填字段: title, content');
  }

  const article = {
    id: crypto.randomUUID(),
    type: 'article',
    title: title.trim(),
    content: content.trim(),
    author: user.username,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  resources.push(article);
  persist();

  send(res, 201, { success: true, data: article });
}

// PUT /api/resources/articles/:id/publish - 发布文章
function publishArticle(req, res, user, id) {
  const article = resources.find((r) => r.id === id && r.type === 'article');
  if (!article) {
    return sendError(res, 404, '文章不存在');
  }

  article.status = 'published';
  article.publishedAt = new Date().toISOString();
  article.publishedBy = user.username;
  persist();

  sendSuccess(res, article);
}

// DELETE /api/resources/articles/:id - 删除文章
function deleteArticle(req, res, user, id) {
  const idx = resources.findIndex((r) => r.id === id && r.type === 'article');
  if (idx === -1) {
    return sendError(res, 404, '文章不存在');
  }

  const deleted = resources.splice(idx, 1)[0];
  persist();

  sendSuccess(res, { message: '文章已删除', data: deleted });
}

// GET /api/resources/dashboard - 仪表盘（需要 dashboard:read 权限）
function getDashboard(req, res, user) {
  sendSuccess(res, {
    totalUsers: users.length,
    totalRoles: Object.keys(roles).length,
    totalPermissions: permissions.length,
    totalArticles: resources.filter((r) => r.type === 'article').length,
    activeTokens: Object.keys(tokens).length,
    recentUsers: users.slice(-5).map(sanitizeUser).reverse(),
  });
}

// ==================== 路由处理 ====================

async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // ========== Auth 路由 ==========
    if (method === 'POST' && pathname === '/api/auth/register') {
      return await register(req, res);
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      return await login(req, res);
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      return requireAuth(logout)(req, res);
    }
    if (method === 'GET' && pathname === '/api/auth/me') {
      return requireAuth(getMe)(req, res);
    }
    if (method === 'GET' && pathname === '/api/auth/permissions') {
      return requireAuth(getMyPermissions)(req, res);
    }
    if (method === 'POST' && pathname === '/api/auth/check-permission') {
      return requireAuth(checkPermission)(req, res);
    }

    // ========== 用户管理路由 ==========
    if (method === 'GET' && pathname === '/api/users') {
      return requirePermission('user:read')(getUsers)(req, res);
    }

    const userMatch = pathname.match(/^\/api\/users\/([\w-]+)$/);
    if (userMatch) {
      const id = userMatch[1];
      if (method === 'GET') {
        return requirePermission('user:read')(getUser)(req, res, id);
      }
      if (method === 'PUT') {
        return requirePermission('user:write')(updateUser)(req, res, id);
      }
      if (method === 'DELETE') {
        return requirePermission('user:delete')(deleteUser)(req, res, id);
      }
    }

    const passwordMatch = pathname.match(/^\/api\/users\/([\w-]+)\/password$/);
    if (passwordMatch && method === 'PUT') {
      return requireAuth(changePassword)(req, res, passwordMatch[1]);
    }

    // ========== 角色管理路由 ==========
    if (method === 'GET' && pathname === '/api/roles') {
      return requirePermission('role:read')(getRoles)(req, res);
    }
    if (method === 'POST' && pathname === '/api/roles') {
      return requirePermission('role:write')(createRole)(req, res);
    }

    const roleMatch = pathname.match(/^\/api\/roles\/([\w]+)$/);
    if (roleMatch) {
      const name = roleMatch[1];
      if (method === 'GET') {
        return requirePermission('role:read')(getRole)(req, res, name);
      }
      if (method === 'PUT') {
        return requirePermission('role:write')(updateRole)(req, res, name);
      }
      if (method === 'DELETE') {
        return requirePermission('role:delete')(deleteRole)(req, res, name);
      }
    }

    // ========== 权限管理路由 ==========
    if (method === 'GET' && pathname === '/api/permissions') {
      return requirePermission('permission:read')(getPermissions)(req, res);
    }
    if (method === 'POST' && pathname === '/api/permissions') {
      return requirePermission('permission:write')(createPermission)(req, res);
    }

    const permMatch = pathname.match(/^\/api\/permissions\/([\w]+)\/([\w]+)$/);
    if (permMatch && method === 'DELETE') {
      return requirePermission('permission:write')(deletePermission)(
        req,
        res,
        permMatch[1],
        permMatch[2]
      );
    }

    // ========== 受保护资源路由（演示权限检查）==========
    if (method === 'GET' && pathname === '/api/resources/articles') {
      return requirePermission('article:read')(getArticles)(req, res);
    }
    if (method === 'POST' && pathname === '/api/resources/articles') {
      return requirePermission('article:write')(createArticle)(req, res);
    }

    const articlePublishMatch = pathname.match(/^\/api\/resources\/articles\/([\w-]+)\/publish$/);
    if (articlePublishMatch && method === 'PUT') {
      return requirePermission('article:publish')(publishArticle)(req, res, articlePublishMatch[1]);
    }

    const articleMatch = pathname.match(/^\/api\/resources\/articles\/([\w-]+)$/);
    if (articleMatch && method === 'DELETE') {
      return requirePermission('article:delete')(deleteArticle)(req, res, articleMatch[1]);
    }

    if (method === 'GET' && pathname === '/api/resources/dashboard') {
      return requirePermission('dashboard:read')(getDashboard)(req, res);
    }

    sendError(res, 404, 'Route not found');
  } catch (err) {
    if (err.message === 'Invalid JSON') {
      return sendError(res, 400, 'Invalid JSON');
    }
    console.error('服务器错误:', err);
    sendError(res, 500, 'Internal server error');
  }
}

// ==================== 启动服务器 ====================

initDefaultData();

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                 🔐 RBAC 权限控制系统 API 已启动                   ║
╠══════════════════════════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                                      ║
╠══════════════════════════════════════════════════════════════════╣
║  认证接口:                                                        ║
║  POST   /api/auth/register             注册用户                   ║
║  POST   /api/auth/login                用户登录                   ║
║  POST   /api/auth/logout               用户登出                   ║
║  GET    /api/auth/me                   当前用户信息               ║
║  GET    /api/auth/permissions          当前用户权限               ║
║  POST   /api/auth/check-permission     检查权限                   ║
╠══════════════════════════════════════════════════════════════════╣
║  用户管理 [user:read/write/delete]:                                ║
║  GET    /api/users                     用户列表                   ║
║  GET    /api/users/:id                 用户详情                   ║
║  PUT    /api/users/:id                 更新用户(角色/状态)        ║
║  DELETE /api/users/:id                 删除用户                   ║
║  PUT    /api/users/:id/password        修改密码                   ║
╠══════════════════════════════════════════════════════════════════╣
║  角色管理 [role:read/write/delete]:                                ║
║  GET    /api/roles                     角色列表                   ║
║  GET    /api/roles/:name               角色详情                   ║
║  POST   /api/roles                     创建角色                   ║
║  PUT    /api/roles/:name               更新角色(权限)             ║
║  DELETE /api/roles/:name               删除角色                   ║
╠══════════════════════════════════════════════════════════════════╣
║  权限管理 [permission:read/write]:                                 ║
║  GET    /api/permissions               权限列表                   ║
║  POST   /api/permissions               注册权限                   ║
║  DELETE /api/permissions/:res/:act     删除权限                   ║
╠══════════════════════════════════════════════════════════════════╣
║  受保护资源 (演示):                                                ║
║  GET    /api/resources/articles        文章列表 [article:read]    ║
║  POST   /api/resources/articles        创建文章 [article:write]   ║
║  PUT    /api/resources/articles/:id/publish  发布 [article:publish]║
║  DELETE /api/resources/articles/:id     删除文章 [article:delete] ║
║  GET    /api/resources/dashboard       仪表盘 [dashboard:read]    ║
╠══════════════════════════════════════════════════════════════════╣
║  默认账户:                                                        ║
║  admin  / admin123  (管理员 - 全部权限)                            ║
║  editor / editor123 (编辑者 - 文章管理)                            ║
║  viewer / viewer123 (查看者 - 只读权限)                            ║
╠══════════════════════════════════════════════════════════════════╣
║  数据目录: ${DATA_DIR}
╚══════════════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  persist();
  server.close(() => {
    console.log('服务器已关闭，数据已保存');
    process.exit(0);
  });
});
