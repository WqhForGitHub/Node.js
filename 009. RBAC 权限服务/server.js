const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3035;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');
const PERMISSIONS_FILE = path.join(DATA_DIR, 'permissions.json');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时
const MAX_AUDIT_LOGS = 5000; // 最大审计日志条数

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
let groups = loadData(GROUPS_FILE, []);
let roles = loadData(ROLES_FILE, {});
let permissions = loadData(PERMISSIONS_FILE, []);
let policies = loadData(POLICIES_FILE, []);
const tokens = loadData(TOKENS_FILE, {});
let auditLogs = loadData(AUDIT_FILE, []);
let resources = loadData(RESOURCES_FILE, []);

// 权限缓存
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function persist() {
  saveData(USERS_FILE, users);
  saveData(GROUPS_FILE, groups);
  saveData(ROLES_FILE, roles);
  saveData(PERMISSIONS_FILE, permissions);
  saveData(POLICIES_FILE, policies);
  saveData(TOKENS_FILE, tokens);
  saveData(AUDIT_FILE, auditLogs);
  saveData(RESOURCES_FILE, resources);
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  // 默认权限定义（6大资源模块）
  if (permissions.length === 0) {
    permissions = [
      // 文章模块
      { resource: 'article', action: 'read', description: '读取文章' },
      { resource: 'article', action: 'write', description: '编写文章' },
      { resource: 'article', action: 'delete', description: '删除文章' },
      { resource: 'article', action: 'publish', description: '发布文章' },
      { resource: 'article', action: 'audit', description: '审核文章' },
      // 用户模块
      { resource: 'user', action: 'read', description: '查看用户' },
      { resource: 'user', action: 'write', description: '编辑用户' },
      { resource: 'user', action: 'delete', description: '删除用户' },
      // 角色模块
      { resource: 'role', action: 'read', description: '查看角色' },
      { resource: 'role', action: 'write', description: '编辑角色' },
      { resource: 'role', action: 'delete', description: '删除角色' },
      // 权限模块
      { resource: 'permission', action: 'read', description: '查看权限' },
      { resource: 'permission', action: 'write', description: '编辑权限' },
      // 用户组模块
      { resource: 'group', action: 'read', description: '查看用户组' },
      { resource: 'group', action: 'write', description: '编辑用户组' },
      { resource: 'group', action: 'delete', description: '删除用户组' },
      // 系统模块
      { resource: 'system', action: 'read', description: '查看系统信息' },
      { resource: 'system', action: 'write', description: '修改系统配置' },
      { resource: 'system', action: 'audit', description: '查看审计日志' },
    ];
  }

  // 默认角色（带继承关系）
  if (Object.keys(roles).length === 0) {
    const now = new Date().toISOString();
    roles = {
      superadmin: {
        name: 'superadmin',
        description: '超级管理员，拥有所有权限，包含通配符',
        permissions: ['*:*'],
        inherits: [],
        dataScope: 'all',
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      admin: {
        name: 'admin',
        description: '管理员，拥有大部分权限',
        permissions: [
          'article:read',
          'article:write',
          'article:delete',
          'article:publish',
          'article:audit',
          'user:read',
          'user:write',
          'user:delete',
          'role:read',
          'role:write',
          'permission:read',
          'group:read',
          'group:write',
          'system:read',
          'system:audit',
        ],
        inherits: ['editor'],
        dataScope: 'all',
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      },
      editor: {
        name: 'editor',
        description: '编辑者，可管理文章和审核',
        permissions: [
          'article:read',
          'article:write',
          'article:delete',
          'article:publish',
          'article:audit',
          'user:read',
          'role:read',
          'permission:read',
          'group:read',
        ],
        inherits: ['author'],
        dataScope: 'department',
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      },
      author: {
        name: 'author',
        description: '作者，可编写和发布自己的文章',
        permissions: [
          'article:read',
          'article:write',
          'article:publish',
          'user:read',
          'role:read',
          'permission:read',
        ],
        inherits: ['viewer'],
        dataScope: 'self',
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      },
      viewer: {
        name: 'viewer',
        description: '查看者，只读权限',
        permissions: ['article:read', 'user:read', 'role:read', 'permission:read'],
        inherits: [],
        dataScope: 'self',
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  // 默认用户组
  if (groups.length === 0) {
    const now = new Date().toISOString();
    groups = [
      {
        id: crypto.randomUUID(),
        name: '技术部',
        description: '技术部门用户组',
        roles: ['editor'],
        members: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '编辑部',
        description: '内容编辑部门用户组',
        roles: ['author'],
        members: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // 默认用户
  if (users.length === 0) {
    const now = new Date().toISOString();
    const techGroup = groups.find((g) => g.name === '技术部');
    const editGroup = groups.find((g) => g.name === '编辑部');

    users.push({
      id: crypto.randomUUID(),
      username: 'superadmin',
      password: hashPassword('admin123'),
      roles: ['superadmin'],
      groups: [],
      department: '总部',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    users.push({
      id: crypto.randomUUID(),
      username: 'admin',
      password: hashPassword('admin123'),
      roles: ['admin'],
      groups: [],
      department: '总部',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const editorUser = {
      id: crypto.randomUUID(),
      username: 'editor',
      password: hashPassword('editor123'),
      roles: ['editor'],
      groups: techGroup ? [techGroup.id] : [],
      department: '技术部',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    users.push(editorUser);
    const authorUser = {
      id: crypto.randomUUID(),
      username: 'author',
      password: hashPassword('author123'),
      roles: ['author'],
      groups: editGroup ? [editGroup.id] : [],
      department: '编辑部',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    users.push(authorUser);
    users.push({
      id: crypto.randomUUID(),
      username: 'viewer',
      password: hashPassword('viewer123'),
      roles: ['viewer'],
      groups: [],
      department: '市场部',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 将用户加入用户组
    if (techGroup) techGroup.members = [editorUser.id];
    if (editGroup) editGroup.members = [authorUser.id];
  }

  // 默认策略
  if (policies.length === 0) {
    const now = new Date().toISOString();
    policies = [
      {
        id: crypto.randomUUID(),
        name: '文章所有权策略',
        description: '作者只能修改/删除自己的文章，编辑可以管理所有文章',
        resource: 'article',
        action: 'write',
        condition: 'owner_or_admin',
        priority: 10,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '文章删除策略',
        description: '作者只能删除自己的草稿文章，编辑和管理员可删除任何文章',
        resource: 'article',
        action: 'delete',
        condition: 'owner_draft_or_admin',
        priority: 20,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // 默认资源数据
  if (resources.length === 0) {
    const now = new Date().toISOString();
    resources = [
      {
        id: crypto.randomUUID(),
        type: 'article',
        title: 'RBAC 权限系统介绍',
        content: '本文介绍基于角色的访问控制系统...',
        author: 'admin',
        authorId: users.find((u) => u.username === 'admin')?.id,
        department: '总部',
        status: 'published',
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        type: 'article',
        title: 'Node.js 最佳实践',
        content: 'Node.js 开发中的最佳实践总结...',
        author: 'editor',
        authorId: users.find((u) => u.username === 'editor')?.id,
        department: '技术部',
        status: 'draft',
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        type: 'article',
        title: '我的第一篇文章',
        content: '这是一篇作者自己写的文章...',
        author: 'author',
        authorId: users.find((u) => u.username === 'author')?.id,
        department: '编辑部',
        status: 'draft',
        createdAt: now,
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
    .update(password + 'rbac_salt_2025')
    .digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== 审计日志 ====================

function addAuditLog(entry) {
  auditLogs.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  // 超过最大条数时裁剪
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs = auditLogs.slice(-MAX_AUDIT_LOGS);
  }
}

// ==================== RBAC 核心引擎 ====================

// 解析角色的所有权限（含继承）
function resolveRolePermissions(roleName, visited = new Set()) {
  if (visited.has(roleName)) return []; // 防止循环继承
  visited.add(roleName);

  const role = roles[roleName];
  if (!role) return [];

  let perms = [...role.permissions];

  // 递归继承
  if (role.inherits && role.inherits.length > 0) {
    for (const parentName of role.inherits) {
      const parentPerms = resolveRolePermissions(parentName, visited);
      perms = [...perms, ...parentPerms];
    }
  }

  return [...new Set(perms)];
}

// 获取用户的所有权限（通过角色 + 用户组聚合）
function getUserPermissions(user) {
  // 检查缓存
  const cacheKey = `perms:${user.id}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.perms;
  }

  const permSet = new Set();

  // 从直接分配的角色获取权限
  for (const roleName of user.roles) {
    const rolePerms = resolveRolePermissions(roleName);
    for (const perm of rolePerms) {
      permSet.add(perm);
    }
  }

  // 从用户组获取权限
  for (const groupId of user.groups || []) {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      for (const roleName of group.roles) {
        const rolePerms = resolveRolePermissions(roleName);
        for (const perm of rolePerms) {
          permSet.add(perm);
        }
      }
    }
  }

  const perms = [...permSet];

  // 写入缓存
  permissionCache.set(cacheKey, { perms, time: Date.now() });

  return perms;
}

// 获取用户的角色列表（含继承的角色）
function getUserRoles(user) {
  const roleSet = new Set();

  for (const roleName of user.roles) {
    roleSet.add(roleName);
    collectInheritedRoles(roleName, roleSet);
  }

  // 从用户组获取角色
  for (const groupId of user.groups || []) {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      for (const roleName of group.roles) {
        roleSet.add(roleName);
        collectInheritedRoles(roleName, roleSet);
      }
    }
  }

  return [...roleSet];
}

function collectInheritedRoles(roleName, visited) {
  const role = roles[roleName];
  if (!role || !role.inherits) return;
  for (const parent of role.inherits) {
    if (!visited.has(parent)) {
      visited.add(parent);
      collectInheritedRoles(parent, visited);
    }
  }
}

// 检查用户是否拥有指定权限（支持通配符）
function hasPermission(user, permission) {
  const userPerms = getUserPermissions(user);
  return matchPermission(userPerms, permission);
}

function matchPermission(userPerms, permission) {
  const [reqRes, reqAct] = permission.split(':');
  return userPerms.some((p) => {
    if (p === permission) return true;
    const [pRes, pAct] = p.split(':');
    // *:* 匹配一切
    if (pRes === '*' && pAct === '*') return true;
    // resource:* 匹配该资源的所有操作
    if (pRes === reqRes && pAct === '*') return true;
    // *:action 匹配所有资源的该操作
    if (pRes === '*' && pAct === reqAct) return true;
    return false;
  });
}

// 批量检查权限（返回详细结果）
function checkPermissions(user, requiredPermissions) {
  const userPerms = getUserPermissions(user);
  const results = {};
  for (const perm of requiredPermissions) {
    results[perm] = matchPermission(userPerms, perm);
  }
  return results;
}

// 检查数据范围权限
function checkDataScope(user, targetResource) {
  const userRoles = getUserRoles(user);
  let maxScope = 'none';

  const scopePriority = { all: 4, department: 3, self: 2, none: 1 };

  for (const roleName of userRoles) {
    const role = roles[roleName];
    if (role) {
      const scope = role.dataScope || 'self';
      if (scopePriority[scope] > scopePriority[maxScope]) {
        maxScope = scope;
      }
    }
  }

  // 根据数据范围判断是否可访问
  switch (maxScope) {
    case 'all':
      return { allowed: true, scope: 'all', reason: '可访问所有数据' };
    case 'department':
      if (targetResource && targetResource.department === user.department) {
        return {
          allowed: true,
          scope: 'department',
          reason: '可访问本部门数据',
        };
      }
      return {
        allowed: false,
        scope: 'department',
        reason: '只能访问本部门数据',
      };
    case 'self':
      if (targetResource && targetResource.authorId === user.id) {
        return { allowed: true, scope: 'self', reason: '可访问自己的数据' };
      }
      return { allowed: false, scope: 'self', reason: '只能访问自己的数据' };
    default:
      return { allowed: false, scope: 'none', reason: '无数据访问权限' };
  }
}

// 评估策略条件
function evaluatePolicy(policy, user, targetResource) {
  if (!policy.enabled) return { pass: true, reason: '策略未启用' };

  switch (policy.condition) {
    case 'owner_or_admin':
      // 管理员角色直接通过
      if (hasPermission(user, 'article:audit')) {
        return { pass: true, reason: '拥有审核权限' };
      }
      // 检查是否是资源所有者
      if (targetResource && targetResource.authorId === user.id) {
        return { pass: true, reason: '是资源所有者' };
      }
      return { pass: false, reason: '非资源所有者且无审核权限' };

    case 'owner_draft_or_admin':
      if (hasPermission(user, 'article:audit')) {
        return { pass: true, reason: '拥有审核权限' };
      }
      if (
        targetResource &&
        targetResource.authorId === user.id &&
        targetResource.status === 'draft'
      ) {
        return { pass: true, reason: '是资源所有者且资源为草稿' };
      }
      return { pass: false, reason: '非所有者或资源非草稿状态' };

    default:
      return { pass: true, reason: '未知条件，默认通过' };
  }
}

// 综合权限检查（RBAC权限 + 策略 + 数据范围）
function checkAccess(user, resource, action, targetResource) {
  const permKey = `${resource}:${action}`;
  const hasPerm = hasPermission(user, permKey);

  if (!hasPerm) {
    addAuditLog({
      type: 'access_denied',
      userId: user.id,
      username: user.username,
      permission: permKey,
      resourceId: targetResource?.id,
      reason: '缺少权限',
    });
    return {
      allowed: false,
      reason: `缺少权限: ${permKey}`,
      details: { hasPermission: false },
    };
  }

  // 检查策略
  const applicablePolicies = policies
    .filter((p) => p.resource === resource && p.action === action && p.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const policy of applicablePolicies) {
    const result = evaluatePolicy(policy, user, targetResource);
    if (!result.pass) {
      addAuditLog({
        type: 'policy_denied',
        userId: user.id,
        username: user.username,
        permission: permKey,
        policyId: policy.id,
        policyName: policy.name,
        resourceId: targetResource?.id,
        reason: result.reason,
      });
      return {
        allowed: false,
        reason: `策略拦截: ${policy.name} - ${result.reason}`,
        details: {
          hasPermission: true,
          policy: policy.name,
          policyReason: result.reason,
        },
      };
    }
  }

  // 检查数据范围
  const scopeResult = checkDataScope(user, targetResource);
  if (!scopeResult.allowed) {
    addAuditLog({
      type: 'scope_denied',
      userId: user.id,
      username: user.username,
      permission: permKey,
      resourceId: targetResource?.id,
      scope: scopeResult.scope,
      reason: scopeResult.reason,
    });
    return {
      allowed: false,
      reason: `数据范围不足: ${scopeResult.reason}`,
      details: {
        hasPermission: true,
        scope: scopeResult.scope,
        scopeReason: scopeResult.reason,
      },
    };
  }

  addAuditLog({
    type: 'access_granted',
    userId: user.id,
    username: user.username,
    permission: permKey,
    resourceId: targetResource?.id,
    scope: scopeResult.scope,
  });

  return {
    allowed: true,
    scope: scopeResult.scope,
    details: {
      hasPermission: true,
      scope: scopeResult.scope,
      scopeReason: scopeResult.reason,
    },
  };
}

// 清除用户权限缓存
function clearUserPermissionCache(userId) {
  if (userId) {
    permissionCache.delete(`perms:${userId}`);
  } else {
    permissionCache.clear();
  }
}

// 获取用户信息（脱敏）
function sanitizeUser(user) {
  const { password, ...rest } = user;
  return {
    ...rest,
    permissions: getUserPermissions(user),
    allRoles: getUserRoles(user),
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

  if (Date.now() - tokenData.createdAt > TOKEN_EXPIRY) {
    delete tokens[token];
    return null;
  }

  const user = users.find((u) => u.id === tokenData.userId && u.isActive);
  return user || null;
}

function requireAuth(handler) {
  return async (req, res, ...args) => {
    const user = authenticate(req);
    if (!user) {
      return sendError(res, 401, '未认证，请先登录');
    }
    return handler(req, res, user, ...args);
  };
}

function requirePermission(permission) {
  return (handler) => {
    return requireAuth(async (req, res, user, ...args) => {
      if (!hasPermission(user, permission)) {
        addAuditLog({
          type: 'permission_denied',
          userId: user.id,
          username: user.username,
          permission,
          path: req.url,
          method: req.method,
        });
        return sendError(res, 403, `权限不足，需要权限: ${permission}`);
      }
      return handler(req, res, user, ...args);
    });
  };
}

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

// POST /api/auth/register
async function register(req, res) {
  const body = await parseBody(req);
  const { username, password, roles: roleNames, department } = body;

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
    groups: [],
    department: department || '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  persist();

  addAuditLog({
    type: 'user_registered',
    userId: user.id,
    username: user.username,
  });

  send(res, 201, { success: true, data: sanitizeUser(user) });
}

// POST /api/auth/login
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

  const token = generateToken();
  tokens[token] = { userId: user.id, createdAt: Date.now() };

  // 清理旧 token（每用户最多5个）
  const userTokens = Object.entries(tokens)
    .filter(([, v]) => v.userId === user.id)
    .sort((a, b) => b[1].createdAt - a[1].createdAt);
  if (userTokens.length > 5) {
    for (let i = 5; i < userTokens.length; i++) {
      delete tokens[userTokens[i][0]];
    }
  }

  persist();

  addAuditLog({ type: 'user_login', userId: user.id, username: user.username });

  sendSuccess(res, { token, user: sanitizeUser(user) });
}

// POST /api/auth/logout
async function logout(req, res, user) {
  const token = getTokenFromHeader(req);
  if (token && tokens[token]) {
    delete tokens[token];
    persist();
  }
  addAuditLog({
    type: 'user_logout',
    userId: user.id,
    username: user.username,
  });
  sendSuccess(res, { message: '已登出' });
}

// GET /api/auth/me
function getMe(req, res, user) {
  sendSuccess(res, sanitizeUser(user));
}

// GET /api/auth/permissions
function getMyPermissions(req, res, user) {
  const perms = getUserPermissions(user);
  const allRoles = getUserRoles(user);
  const roleDetails = allRoles
    .map((r) => roles[r])
    .filter(Boolean)
    .map((r) => ({
      name: r.name,
      description: r.description,
      permissions: resolveRolePermissions(r.name),
      dataScope: r.dataScope,
      inherits: r.inherits,
    }));

  sendSuccess(res, {
    user: { id: user.id, username: user.username, department: user.department },
    roles: roleDetails,
    directRoles: user.roles,
    inheritedRoles: allRoles.filter((r) => !user.roles.includes(r)),
    permissions: perms,
  });
}

// POST /api/auth/check-permission
async function checkPermissionEndpoint(req, res, user) {
  const body = await parseBody(req);
  const { permissions: requiredPerms, resourceId } = body;

  if (!requiredPerms || !Array.isArray(requiredPerms) || requiredPerms.length === 0) {
    return sendError(res, 400, '缺少必填字段: permissions (数组)');
  }

  const results = checkPermissions(user, requiredPerms);
  const allGranted = Object.values(results).every(Boolean);

  // 如果提供了 resourceId，进行数据范围检查
  let scopeCheck = null;
  if (resourceId) {
    const targetResource = resources.find((r) => r.id === resourceId);
    if (targetResource) {
      scopeCheck = checkDataScope(user, targetResource);
    }
  }

  sendSuccess(res, {
    allGranted,
    results,
    scopeCheck,
  });
}

// POST /api/auth/check-access - 综合权限检查
async function checkAccessEndpoint(req, res, user) {
  const body = await parseBody(req);
  const { resource, action, resourceId } = body;

  if (!resource || !action) {
    return sendError(res, 400, '缺少必填字段: resource, action');
  }

  const targetResource = resourceId ? resources.find((r) => r.id === resourceId) : null;

  const result = checkAccess(user, resource, action, targetResource);
  sendSuccess(res, result);
}

// ==================== 用户管理 API ====================

// GET /api/users
function getUsers(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { page = '1', limit = '20', search, role, department } = parsedUrl.query;

  let filtered = users.map(sanitizeUser);

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter((u) => u.username.toLowerCase().includes(s));
  }
  if (role) {
    filtered = filtered.filter((u) => u.roles.includes(role));
  }
  if (department) {
    filtered = filtered.filter((u) => u.department === department);
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

// GET /api/users/:id
function getUser(req, res, _user, id) {
  const target = users.find((u) => u.id === id);
  if (!target) return sendError(res, 404, '用户不存在');
  sendSuccess(res, sanitizeUser(target));
}

// PUT /api/users/:id
async function updateUser(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) return sendError(res, 404, '用户不存在');

  const body = await parseBody(req);
  const { roles: newRoles, groups: newGroups, isActive, department } = body;

  if (target.id === currentUser.id && newRoles) {
    return sendError(res, 403, '不能修改自己的角色');
  }
  if (target.id === currentUser.id && isActive === false) {
    return sendError(res, 403, '不能禁用自己');
  }

  if (newRoles !== undefined) {
    if (!Array.isArray(newRoles)) return sendError(res, 400, 'roles 必须是数组');
    for (const r of newRoles) {
      if (!roles[r]) return sendError(res, 400, `角色不存在: ${r}`);
    }
    target.roles = newRoles;
  }

  if (newGroups !== undefined) {
    if (!Array.isArray(newGroups)) return sendError(res, 400, 'groups 必须是数组');
    for (const gid of newGroups) {
      if (!groups.find((g) => g.id === gid)) return sendError(res, 400, `用户组不存在: ${gid}`);
    }
    target.groups = newGroups;
  }

  if (isActive !== undefined) target.isActive = Boolean(isActive);
  if (department !== undefined) target.department = department;

  target.updatedAt = new Date().toISOString();
  clearUserPermissionCache(target.id);
  persist();

  addAuditLog({
    type: 'user_updated',
    userId: currentUser.id,
    username: currentUser.username,
    targetUserId: target.id,
    targetUsername: target.username,
  });

  sendSuccess(res, sanitizeUser(target));
}

// DELETE /api/users/:id
function deleteUser(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) return sendError(res, 404, '用户不存在');
  if (target.id === currentUser.id) return sendError(res, 403, '不能删除自己');

  users = users.filter((u) => u.id !== id);

  // 清理 token
  for (const [token, data] of Object.entries(tokens)) {
    if (data.userId === id) delete tokens[token];
  }

  // 从用户组中移除
  for (const group of groups) {
    group.members = group.members.filter((m) => m !== id);
  }

  clearUserPermissionCache(id);
  persist();

  addAuditLog({
    type: 'user_deleted',
    userId: currentUser.id,
    username: currentUser.username,
    targetUserId: id,
    targetUsername: target.username,
  });

  sendSuccess(res, { message: '用户已删除' });
}

// PUT /api/users/:id/password
async function changePassword(req, res, currentUser, id) {
  const target = users.find((u) => u.id === id);
  if (!target) return sendError(res, 404, '用户不存在');

  if (target.id !== currentUser.id && !hasPermission(currentUser, 'user:write')) {
    return sendError(res, 403, '权限不足');
  }

  const body = await parseBody(req);
  const { oldPassword, newPassword } = body;

  if (target.id === currentUser.id) {
    if (!oldPassword) return sendError(res, 400, '缺少必填字段: oldPassword');
    if (target.password !== hashPassword(oldPassword)) return sendError(res, 401, '旧密码错误');
  }

  if (!newPassword || newPassword.length < 6) {
    return sendError(res, 400, '新密码长度至少6个字符');
  }

  target.password = hashPassword(newPassword);
  target.updatedAt = new Date().toISOString();

  // 强制重新登录
  for (const [token, data] of Object.entries(tokens)) {
    if (data.userId === id) delete tokens[token];
  }

  persist();
  sendSuccess(res, { message: '密码已修改，请重新登录' });
}

// ==================== 用户组管理 API ====================

// GET /api/groups
function getGroups(req, res) {
  const result = groups.map((g) => ({
    ...g,
    memberCount: g.members.length,
    members: g.members
      .map((uid) => {
        const u = users.find((x) => x.id === uid);
        return u ? { id: u.id, username: u.username } : null;
      })
      .filter(Boolean),
  }));
  sendSuccess(res, result);
}

// GET /api/groups/:id
function getGroup(req, res, _user, id) {
  const group = groups.find((g) => g.id === id);
  if (!group) return sendError(res, 404, '用户组不存在');

  sendSuccess(res, {
    ...group,
    memberCount: group.members.length,
    members: group.members
      .map((uid) => {
        const u = users.find((x) => x.id === uid);
        return u ? sanitizeUser(u) : null;
      })
      .filter(Boolean),
    roleDetails: group.roles
      .map((r) => roles[r])
      .filter(Boolean)
      .map((r) => ({
        name: r.name,
        description: r.description,
        dataScope: r.dataScope,
      })),
  });
}

// POST /api/groups
async function createGroup(req, res) {
  const body = await parseBody(req);
  const { name, description, roles: groupRoles } = body;

  if (!name) return sendError(res, 400, '缺少必填字段: name');
  if (groups.find((g) => g.name === name)) return sendError(res, 409, '用户组已存在');

  const validatedRoles = (groupRoles || []).filter((r) => roles[r]);
  const now = new Date().toISOString();

  const group = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description || '',
    roles: validatedRoles,
    members: [],
    createdAt: now,
    updatedAt: now,
  };

  groups.push(group);
  persist();

  addAuditLog({ type: 'group_created', groupName: group.name });

  send(res, 201, { success: true, data: group });
}

// PUT /api/groups/:id
async function updateGroup(req, res, _user, id) {
  const group = groups.find((g) => g.id === id);
  if (!group) return sendError(res, 404, '用户组不存在');

  const body = await parseBody(req);
  const {
    name,
    description,
    roles: groupRoles,
    addMembers,
    removeMembers,
    addRoles,
    removeRoles,
  } = body;

  if (name !== undefined) group.name = name.trim();
  if (description !== undefined) group.description = description;

  // 直接设置角色
  if (groupRoles !== undefined) {
    if (!Array.isArray(groupRoles)) return sendError(res, 400, 'roles 必须是数组');
    for (const r of groupRoles) {
      if (!roles[r]) return sendError(res, 400, `角色不存在: ${r}`);
    }
    group.roles = groupRoles;
  }

  // 增量添加角色
  if (addRoles !== undefined) {
    for (const r of addRoles) {
      if (roles[r] && !group.roles.includes(r)) group.roles.push(r);
    }
  }

  // 增量移除角色
  if (removeRoles !== undefined) {
    group.roles = group.roles.filter((r) => !removeRoles.includes(r));
  }

  // 增量添加成员
  if (addMembers !== undefined) {
    for (const uid of addMembers) {
      if (users.find((u) => u.id === uid) && !group.members.includes(uid)) {
        group.members.push(uid);
      }
    }
  }

  // 增量移除成员
  if (removeMembers !== undefined) {
    group.members = group.members.filter((m) => !removeMembers.includes(m));
  }

  group.updatedAt = new Date().toISOString();

  // 清除组成员的权限缓存
  for (const uid of group.members) {
    clearUserPermissionCache(uid);
  }

  persist();

  addAuditLog({ type: 'group_updated', groupName: group.name });

  sendSuccess(res, group);
}

// DELETE /api/groups/:id
function deleteGroup(req, res, _user, id) {
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return sendError(res, 404, '用户组不存在');

  const group = groups[idx];

  // 从用户中移除该组
  for (const uid of group.members) {
    const user = users.find((u) => u.id === uid);
    if (user) {
      user.groups = (user.groups || []).filter((g) => g !== id);
      clearUserPermissionCache(uid);
    }
  }

  groups.splice(idx, 1);
  persist();

  addAuditLog({ type: 'group_deleted', groupName: group.name });

  sendSuccess(res, { message: '用户组已删除' });
}

// ==================== 角色管理 API ====================

// GET /api/roles
function getRoles(req, res) {
  const roleList = Object.values(roles).map((r) => ({
    ...r,
    resolvedPermissions: resolveRolePermissions(r.name),
    userCount: users.filter((u) => u.roles.includes(r.name)).length,
    groupCount: groups.filter((g) => g.roles.includes(r.name)).length,
  }));
  sendSuccess(res, roleList);
}

// GET /api/roles/:name
function getRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) return sendError(res, 404, '角色不存在');

  const usersWithRole = users.filter((u) => u.roles.includes(name)).map(sanitizeUser);
  const groupsWithRole = groups.filter((g) => g.roles.includes(name));
  const inheritedRoles = role.inherits || [];
  const inheritedDetails = inheritedRoles.map((r) => roles[r]).filter(Boolean);

  // 检测循环继承
  const inheritanceChain = [];
  const detectCycle = (roleName, chain) => {
    if (chain.includes(roleName)) return true;
    const r = roles[roleName];
    if (!r || !r.inherits) return false;
    for (const parent of r.inherits) {
      if (detectCycle(parent, [...chain, roleName])) return true;
    }
    return false;
  };
  const hasCycle = detectCycle(name, []);

  sendSuccess(res, {
    ...role,
    resolvedPermissions: resolveRolePermissions(name),
    inheritedFrom: inheritedDetails,
    hasCycle,
    users: usersWithRole,
    userCount: usersWithRole.length,
    groups: groupsWithRole,
    groupCount: groupsWithRole.length,
  });
}

// POST /api/roles
async function createRole(req, res) {
  const body = await parseBody(req);
  const { name, description, permissions: rolePerms, inherits, dataScope } = body;

  if (!name) return sendError(res, 400, '缺少必填字段: name');
  if (roles[name]) return sendError(res, 409, '角色已存在');
  if (!/^[a-z][a-z0-9_]{1,29}$/.test(name)) {
    return sendError(res, 400, '角色名只能包含小写字母、数字和下划线，2-30个字符，以字母开头');
  }

  // 验证继承
  if (inherits && inherits.length > 0) {
    for (const parent of inherits) {
      if (!roles[parent]) return sendError(res, 400, `父角色不存在: ${parent}`);
      if (parent === name) return sendError(res, 400, '角色不能继承自身');
    }
  }

  const validatedPerms = (rolePerms || []).filter((p) => {
    if (p === '*:*') return true;
    const [r, a] = p.split(':');
    return permissions.some((perm) => perm.resource === r && perm.action === a);
  });

  const now = new Date().toISOString();
  const role = {
    name,
    description: description || '',
    permissions: validatedPerms,
    inherits: inherits || [],
    dataScope: dataScope || 'self',
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };

  roles[name] = role;
  clearUserPermissionCache(); // 清除所有缓存
  persist();

  addAuditLog({ type: 'role_created', roleName: name });

  send(res, 201, { success: true, data: role });
}

// PUT /api/roles/:name
async function updateRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) return sendError(res, 404, '角色不存在');

  const body = await parseBody(req);
  const {
    description,
    permissions: rolePerms,
    inherits,
    dataScope,
    addPermissions,
    removePermissions,
  } = body;

  if (description !== undefined) role.description = description;

  if (rolePerms !== undefined) {
    if (!Array.isArray(rolePerms)) return sendError(res, 400, 'permissions 必须是数组');
    role.permissions = rolePerms.filter((p) => {
      if (p === '*:*') return true;
      const [r, a] = p.split(':');
      return permissions.some((perm) => perm.resource === r && perm.action === a);
    });
  }

  if (addPermissions !== undefined) {
    for (const p of addPermissions) {
      if (!role.permissions.includes(p)) role.permissions.push(p);
    }
  }

  if (removePermissions !== undefined) {
    role.permissions = role.permissions.filter((p) => !removePermissions.includes(p));
  }

  if (inherits !== undefined) {
    if (!Array.isArray(inherits)) return sendError(res, 400, 'inherits 必须是数组');
    for (const parent of inherits) {
      if (!roles[parent]) return sendError(res, 400, `父角色不存在: ${parent}`);
      if (parent === name) return sendError(res, 400, '角色不能继承自身');
    }
    role.inherits = inherits;
  }

  if (dataScope !== undefined) {
    if (!['all', 'department', 'self', 'none'].includes(dataScope)) {
      return sendError(res, 400, 'dataScope 必须是 all, department, self, none 之一');
    }
    role.dataScope = dataScope;
  }

  role.updatedAt = new Date().toISOString();
  clearUserPermissionCache();
  persist();

  addAuditLog({ type: 'role_updated', roleName: name });

  sendSuccess(res, role);
}

// DELETE /api/roles/:name
function deleteRole(req, res, _user, name) {
  const role = roles[name];
  if (!role) return sendError(res, 404, '角色不存在');
  if (role.isSystem) return sendError(res, 403, '系统内置角色不可删除');

  const usersWithRole = users.filter((u) => u.roles.includes(name));
  if (usersWithRole.length > 0) {
    return sendError(res, 409, `该角色正在被 ${usersWithRole.length} 个用户使用，无法删除`);
  }

  // 检查是否有其他角色继承该角色
  const inheritingRoles = Object.values(roles).filter(
    (r) => r.inherits && r.inherits.includes(name)
  );
  if (inheritingRoles.length > 0) {
    return sendError(
      res,
      409,
      `该角色被 [${inheritingRoles.map((r) => r.name).join(', ')}] 继承，无法删除`
    );
  }

  // 检查用户组
  const groupsWithRole = groups.filter((g) => g.roles.includes(name));
  if (groupsWithRole.length > 0) {
    return sendError(res, 409, `该角色被 ${groupsWithRole.length} 个用户组使用，无法删除`);
  }

  delete roles[name];
  clearUserPermissionCache();
  persist();

  addAuditLog({ type: 'role_deleted', roleName: name });

  sendSuccess(res, { message: '角色已删除' });
}

// GET /api/roles/:name/inheritance-tree - 获取角色继承树
function getRoleInheritanceTree(req, res, _user, name) {
  const role = roles[name];
  if (!role) return sendError(res, 404, '角色不存在');

  function buildTree(roleName, visited = new Set()) {
    if (visited.has(roleName)) return { name: roleName, cycle: true, children: [] };
    visited.add(roleName);

    const r = roles[roleName];
    if (!r) return { name: roleName, notFound: true, children: [] };

    return {
      name: roleName,
      description: r.description,
      permissions: r.permissions,
      dataScope: r.dataScope,
      children: (r.inherits || []).map((parent) => buildTree(parent, new Set(visited))),
    };
  }

  sendSuccess(res, buildTree(name));
}

// ==================== 权限管理 API ====================

// GET /api/permissions
function getPermissions(req, res) {
  const grouped = {};
  for (const p of permissions) {
    if (!grouped[p.resource]) grouped[p.resource] = [];
    grouped[p.resource].push(p);
  }

  sendSuccess(res, { list: permissions, grouped, total: permissions.length });
}

// POST /api/permissions
async function createPermission(req, res) {
  const body = await parseBody(req);
  const { resource, action, description } = body;

  if (!resource || !action) return sendError(res, 400, '缺少必填字段: resource, action');
  if (!/^[a-z][a-z0-9_]*$/.test(resource)) return sendError(res, 400, 'resource 格式不合法');
  if (!/^[a-z][a-z0-9_]*$/.test(action)) return sendError(res, 400, 'action 格式不合法');

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

  addAuditLog({
    type: 'permission_created',
    permission: `${resource}:${action}`,
  });

  send(res, 201, { success: true, data: perm });
}

// DELETE /api/permissions/:resource/:action
function deletePermission(req, res, _user, resource, action) {
  const idx = permissions.findIndex((p) => p.resource === resource && p.action === action);
  if (idx === -1) return sendError(res, 404, '权限不存在');

  const permKey = `${resource}:${action}`;

  // 从所有角色中移除该权限
  for (const role of Object.values(roles)) {
    role.permissions = role.permissions.filter((p) => p !== permKey);
  }

  permissions.splice(idx, 1);
  clearUserPermissionCache();
  persist();

  addAuditLog({ type: 'permission_deleted', permission: permKey });

  sendSuccess(res, { message: '权限已删除，已从所有角色中移除' });
}

// ==================== 策略管理 API ====================

// GET /api/policies
function getPolicies(req, res) {
  const sorted = [...policies].sort((a, b) => b.priority - a.priority);
  sendSuccess(res, sorted);
}

// POST /api/policies
async function createPolicy(req, res) {
  const body = await parseBody(req);
  const { name, description, resource, action, condition, priority, enabled } = body;

  if (!name || !resource || !action || !condition) {
    return sendError(res, 400, '缺少必填字段: name, resource, action, condition');
  }

  const validConditions = ['owner_or_admin', 'owner_draft_or_admin'];
  if (!validConditions.includes(condition)) {
    return sendError(res, 400, `condition 必须是: ${validConditions.join(', ')}`);
  }

  const now = new Date().toISOString();
  const policy = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description || '',
    resource,
    action,
    condition,
    priority: priority || 0,
    enabled: enabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  policies.push(policy);
  persist();

  addAuditLog({ type: 'policy_created', policyName: policy.name });

  send(res, 201, { success: true, data: policy });
}

// PUT /api/policies/:id
async function updatePolicy(req, res, _user, id) {
  const policy = policies.find((p) => p.id === id);
  if (!policy) return sendError(res, 404, '策略不存在');

  const body = await parseBody(req);
  const { name, description, resource, action, condition, priority, enabled } = body;

  if (name !== undefined) policy.name = name.trim();
  if (description !== undefined) policy.description = description;
  if (resource !== undefined) policy.resource = resource;
  if (action !== undefined) policy.action = action;
  if (condition !== undefined) policy.condition = condition;
  if (priority !== undefined) policy.priority = priority;
  if (enabled !== undefined) policy.enabled = enabled;

  policy.updatedAt = new Date().toISOString();
  persist();

  addAuditLog({ type: 'policy_updated', policyName: policy.name });

  sendSuccess(res, policy);
}

// DELETE /api/policies/:id
function deletePolicy(req, res, _user, id) {
  const idx = policies.findIndex((p) => p.id === id);
  if (idx === -1) return sendError(res, 404, '策略不存在');

  const deleted = policies.splice(idx, 1)[0];
  persist();

  addAuditLog({ type: 'policy_deleted', policyName: deleted.name });

  sendSuccess(res, { message: '策略已删除' });
}

// ==================== 审计日志 API ====================

// GET /api/audit
function getAuditLogs(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const {
    page = '1',
    limit = '50',
    type,
    userId,
    permission,
    startDate,
    endDate,
  } = parsedUrl.query;

  let filtered = [...auditLogs];

  if (type) filtered = filtered.filter((l) => l.type === type);
  if (userId) filtered = filtered.filter((l) => l.userId === userId);
  if (permission) filtered = filtered.filter((l) => l.permission === permission);
  if (startDate) filtered = filtered.filter((l) => l.timestamp >= startDate);
  if (endDate) filtered = filtered.filter((l) => l.timestamp <= endDate);

  // 按时间倒序
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const start = (pageNum - 1) * limitNum;
  const paged = filtered.slice(start, start + limitNum);

  sendSuccess(res, paged, {
    total: filtered.length,
    page: pageNum,
    limit: limitNum,
  });
}

// GET /api/audit/stats
function getAuditStats(req, res) {
  const now = new Date();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const recentLogs = auditLogs.filter((l) => l.timestamp >= oneDayAgo);
  const hourlyLogs = auditLogs.filter((l) => l.timestamp >= oneHourAgo);

  const typeCounts = {};
  for (const log of recentLogs) {
    typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
  }

  sendSuccess(res, {
    totalLogs: auditLogs.length,
    last24h: recentLogs.length,
    last1h: hourlyLogs.length,
    typeCounts,
  });
}

// ==================== 受保护资源 API ====================

// GET /api/resources/articles
function getArticles(req, res, user) {
  const parsedUrl = url.parse(req.url, true);
  const { status, author } = parsedUrl.query;

  let filtered = resources.filter((r) => r.type === 'article');

  // 数据范围过滤
  const allRoles = getUserRoles(user);
  let maxScope = 'none';
  const scopePriority = { all: 4, department: 3, self: 2, none: 1 };
  for (const roleName of allRoles) {
    const role = roles[roleName];
    if (role) {
      const scope = role.dataScope || 'self';
      if (scopePriority[scope] > scopePriority[maxScope]) maxScope = scope;
    }
  }

  if (maxScope === 'self') {
    filtered = filtered.filter((r) => r.authorId === user.id);
  } else if (maxScope === 'department') {
    filtered = filtered.filter((r) => r.department === user.department);
  }

  if (status) filtered = filtered.filter((r) => r.status === status);
  if (author) filtered = filtered.filter((r) => r.author === author);

  addAuditLog({
    type: 'resource_accessed',
    userId: user.id,
    username: user.username,
    permission: 'article:read',
    scope: maxScope,
    resultCount: filtered.length,
  });

  sendSuccess(res, filtered, { total: filtered.length, scope: maxScope });
}

// POST /api/resources/articles
async function createArticle(req, res, user) {
  const body = await parseBody(req);
  const { title, content } = body;

  if (!title || !content) return sendError(res, 400, '缺少必填字段: title, content');

  const article = {
    id: crypto.randomUUID(),
    type: 'article',
    title: title.trim(),
    content: content.trim(),
    author: user.username,
    authorId: user.id,
    department: user.department,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  resources.push(article);
  persist();

  addAuditLog({
    type: 'resource_created',
    userId: user.id,
    username: user.username,
    resourceId: article.id,
    permission: 'article:write',
  });

  send(res, 201, { success: true, data: article });
}

// PUT /api/resources/articles/:id
async function updateArticle(req, res, user, id) {
  const article = resources.find((r) => r.id === id && r.type === 'article');
  if (!article) return sendError(res, 404, '文章不存在');

  // 综合权限检查
  const access = checkAccess(user, 'article', 'write', article);
  if (!access.allowed) return sendError(res, 403, access.reason);

  const body = await parseBody(req);
  if (body.title !== undefined) article.title = body.title.trim();
  if (body.content !== undefined) article.content = body.content.trim();

  article.updatedAt = new Date().toISOString();
  persist();

  sendSuccess(res, article);
}

// PUT /api/resources/articles/:id/publish
function publishArticle(req, res, user, id) {
  const article = resources.find((r) => r.id === id && r.type === 'article');
  if (!article) return sendError(res, 404, '文章不存在');

  const access = checkAccess(user, 'article', 'publish', article);
  if (!access.allowed) return sendError(res, 403, access.reason);

  article.status = 'published';
  article.publishedAt = new Date().toISOString();
  article.publishedBy = user.username;
  persist();

  sendSuccess(res, article);
}

// DELETE /api/resources/articles/:id
function deleteArticle(req, res, user, id) {
  const idx = resources.findIndex((r) => r.id === id && r.type === 'article');
  if (idx === -1) return sendError(res, 404, '文章不存在');

  const article = resources[idx];
  const access = checkAccess(user, 'article', 'delete', article);
  if (!access.allowed) return sendError(res, 403, access.reason);

  const deleted = resources.splice(idx, 1)[0];
  persist();

  sendSuccess(res, { message: '文章已删除', data: deleted });
}

// GET /api/resources/dashboard
function getDashboard(req, res, user) {
  sendSuccess(res, {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    totalRoles: Object.keys(roles).length,
    totalPermissions: permissions.length,
    totalPolicies: policies.length,
    totalGroups: groups.length,
    totalArticles: resources.filter((r) => r.type === 'article').length,
    activeTokens: Object.keys(tokens).length,
    auditLogCount: auditLogs.length,
    recentUsers: users.slice(-5).map(sanitizeUser).reverse(),
  });
}

// ==================== 系统信息 API ====================

// GET /api/system/info
function getSystemInfo(req, res) {
  sendSuccess(res, {
    name: 'RBAC 权限服务',
    version: '1.0.0',
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    stats: {
      users: users.length,
      roles: Object.keys(roles).length,
      permissions: permissions.length,
      policies: policies.length,
      groups: groups.length,
      resources: resources.length,
      auditLogs: auditLogs.length,
      activeTokens: Object.keys(tokens).length,
    },
    cacheSize: permissionCache.size,
  });
}

// POST /api/system/cache/clear
function clearCache(req, res) {
  const size = permissionCache.size;
  permissionCache.clear();
  sendSuccess(res, { message: `已清除 ${size} 条缓存` });
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
      return requireAuth(checkPermissionEndpoint)(req, res);
    }
    if (method === 'POST' && pathname === '/api/auth/check-access') {
      return requireAuth(checkAccessEndpoint)(req, res);
    }

    // ========== 用户管理路由 ==========
    if (method === 'GET' && pathname === '/api/users') {
      return requirePermission('user:read')(getUsers)(req, res);
    }

    const userMatch = pathname.match(/^\/api\/users\/([\w-]+)$/);
    if (userMatch) {
      const id = userMatch[1];
      if (method === 'GET') return requirePermission('user:read')(getUser)(req, res, id);
      if (method === 'PUT') return requirePermission('user:write')(updateUser)(req, res, id);
      if (method === 'DELETE') return requirePermission('user:delete')(deleteUser)(req, res, id);
    }

    const passwordMatch = pathname.match(/^\/api\/users\/([\w-]+)\/password$/);
    if (passwordMatch && method === 'PUT') {
      return requireAuth(changePassword)(req, res, passwordMatch[1]);
    }

    // ========== 用户组路由 ==========
    if (method === 'GET' && pathname === '/api/groups') {
      return requirePermission('group:read')(getGroups)(req, res);
    }
    if (method === 'POST' && pathname === '/api/groups') {
      return requirePermission('group:write')(createGroup)(req, res);
    }

    const groupMatch = pathname.match(/^\/api\/groups\/([\w-]+)$/);
    if (groupMatch) {
      const id = groupMatch[1];
      if (method === 'GET') return requirePermission('group:read')(getGroup)(req, res, id);
      if (method === 'PUT') return requirePermission('group:write')(updateGroup)(req, res, id);
      if (method === 'DELETE') return requirePermission('group:delete')(deleteGroup)(req, res, id);
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
      if (method === 'GET') return requirePermission('role:read')(getRole)(req, res, name);
      if (method === 'PUT') return requirePermission('role:write')(updateRole)(req, res, name);
      if (method === 'DELETE') return requirePermission('role:delete')(deleteRole)(req, res, name);
    }

    const roleTreeMatch = pathname.match(/^\/api\/roles\/([\w]+)\/inheritance-tree$/);
    if (roleTreeMatch && method === 'GET') {
      return requirePermission('role:read')(getRoleInheritanceTree)(req, res, roleTreeMatch[1]);
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

    // ========== 策略管理路由 ==========
    if (method === 'GET' && pathname === '/api/policies') {
      return requirePermission('permission:read')(getPolicies)(req, res);
    }
    if (method === 'POST' && pathname === '/api/policies') {
      return requirePermission('system:write')(createPolicy)(req, res);
    }

    const policyMatch = pathname.match(/^\/api\/policies\/([\w-]+)$/);
    if (policyMatch) {
      const id = policyMatch[1];
      if (method === 'PUT') return requirePermission('system:write')(updatePolicy)(req, res, id);
      if (method === 'DELETE') return requirePermission('system:write')(deletePolicy)(req, res, id);
    }

    // ========== 审计日志路由 ==========
    if (method === 'GET' && pathname === '/api/audit') {
      return requirePermission('system:audit')(getAuditLogs)(req, res);
    }
    if (method === 'GET' && pathname === '/api/audit/stats') {
      return requirePermission('system:audit')(getAuditStats)(req, res);
    }

    // ========== 受保护资源路由 ==========
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
    if (articleMatch) {
      const id = articleMatch[1];
      if (method === 'PUT') return requirePermission('article:write')(updateArticle)(req, res, id);
      if (method === 'DELETE')
        return requirePermission('article:delete')(deleteArticle)(req, res, id);
    }

    if (method === 'GET' && pathname === '/api/resources/dashboard') {
      return requireAnyPermission('dashboard:read', 'system:read')(getDashboard)(req, res);
    }

    // ========== 系统路由 ==========
    if (method === 'GET' && pathname === '/api/system/info') {
      return requirePermission('system:read')(getSystemInfo)(req, res);
    }
    if (method === 'POST' && pathname === '/api/system/cache/clear') {
      return requirePermission('system:write')(clearCache)(req, res);
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
╔══════════════════════════════════════════════════════════════════════════╗
║                    RBAC 权限服务 API 已启动                              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║  认证接口:                                                                ║
║  POST   /api/auth/register             注册用户                           ║
║  POST   /api/auth/login                用户登录                           ║
║  POST   /api/auth/logout               用户登出                           ║
║  GET    /api/auth/me                   当前用户信息                       ║
║  GET    /api/auth/permissions          当前用户权限(含继承)               ║
║  POST   /api/auth/check-permission     批量检查权限                       ║
║  POST   /api/auth/check-access         综合权限检查(权限+策略+范围)       ║
╠══════════════════════════════════════════════════════════════════════════╣
║  用户管理 [user:read/write/delete]:                                      ║
║  GET    /api/users                     用户列表(支持搜索/角色/部门筛选)   ║
║  GET    /api/users/:id                 用户详情                           ║
║  PUT    /api/users/:id                 更新用户(角色/组/部门/状态)        ║
║  DELETE /api/users/:id                 删除用户                           ║
║  PUT    /api/users/:id/password        修改密码                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║  用户组管理 [group:read/write/delete]:                                   ║
║  GET    /api/groups                    用户组列表                         ║
║  GET    /api/groups/:id                用户组详情(含成员和角色)           ║
║  POST   /api/groups                    创建用户组                         ║
║  PUT    /api/groups/:id                更新用户组(角色/成员增删)          ║
║  DELETE /api/groups/:id                删除用户组                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║  角色管理 [role:read/write/delete]:                                      ║
║  GET    /api/roles                     角色列表(含解析权限和用户数)       ║
║  GET    /api/roles/:name               角色详情(含继承链/用户/组)         ║
║  POST   /api/roles                     创建角色(支持继承和数据范围)       ║
║  PUT    /api/roles/:name               更新角色(权限/继承/范围增删)      ║
║  DELETE /api/roles/:name               删除角色                           ║
║  GET    /api/roles/:name/inheritance-tree  角色继承树                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║  权限管理 [permission:read/write]:                                       ║
║  GET    /api/permissions               权限列表(按资源分组)               ║
║  POST   /api/permissions               注册权限                           ║
║  DELETE /api/permissions/:res/:act     删除权限                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║  策略管理 [system:write]:                                                ║
║  GET    /api/policies                  策略列表(按优先级排序)             ║
║  POST   /api/policies                  创建策略                           ║
║  PUT    /api/policies/:id              更新策略                           ║
║  DELETE /api/policies/:id              删除策略                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║  审计日志 [system:audit]:                                                ║
║  GET    /api/audit                     审计日志(支持类型/用户/时间筛选)   ║
║  GET    /api/audit/stats               审计统计                           ║
╠══════════════════════════════════════════════════════════════════════════╣
║  受保护资源 (综合权限检查演示):                                          ║
║  GET    /api/resources/articles        文章列表(按数据范围过滤)           ║
║  POST   /api/resources/articles        创建文章 [article:write]           ║
║  PUT    /api/resources/articles/:id    更新文章 [策略+范围检查]           ║
║  PUT    .../:id/publish                发布文章 [article:publish]         ║
║  DELETE .../:id                        删除文章 [策略+范围检查]           ║
║  GET    /api/resources/dashboard       仪表盘 [system:read]               ║
╠══════════════════════════════════════════════════════════════════════════╣
║  系统管理 [system:read/write]:                                           ║
║  GET    /api/system/info               系统信息                           ║
║  POST   /api/system/cache/clear        清除权限缓存                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║  默认账户:                                                                ║
║  superadmin / admin123  (超级管理员 - 通配符权限, 数据范围:全部)          ║
║  admin      / admin123  (管理员     - 继承editor, 数据范围:全部)          ║
║  editor     / editor123 (编辑者     - 继承author, 数据范围:本部门)        ║
║  author     / author123 (作者       - 继承viewer, 数据范围:仅自己)        ║
║  viewer     / viewer123 (查看者     - 只读权限, 数据范围:仅自己)          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  角色继承链:                                                              ║
║  superadmin > (通配符 *:*)                                               ║
║  admin      > editor > author > viewer                                   ║
║  数据范围: all > department > self > none                                ║
╠══════════════════════════════════════════════════════════════════════════╣
║  数据目录: ${DATA_DIR}
╚══════════════════════════════════════════════════════════════════════════╝
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
