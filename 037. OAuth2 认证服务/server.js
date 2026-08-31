/**
 * OAuth2 认证服务 - 纯 Node.js 实现
 *
 * 支持的授权类型:
 *   - Authorization Code（授权码模式）
 *   - Authorization Code + PKCE
 *   - Client Credentials（客户端凭证模式）
 *   - Resource Owner Password Credentials（密码模式）
 *   - Refresh Token（刷新令牌）
 *
 * 功能:
 *   - 客户端注册与管理
 *   - 授权码签发与验证
 *   - Access Token / Refresh Token 签发
 *   - 令牌自省 (Introspection)
 *   - 令牌撤销 (Revocation)
 *   - 作用域 (Scope) 管理
 *   - 用户管理
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 配置 ====================

const PORT = 3700;
const DATA_DIR = path.join(__dirname, 'data');
const ACCESS_TOKEN_EXPIRY = 3600; // Access Token 有效期: 1小时（秒）
const REFRESH_TOKEN_EXPIRY = 86400 * 7; // Refresh Token 有效期: 7天（秒）
const AUTH_CODE_EXPIRY = 600; // 授权码有效期: 10分钟（秒）

// ==================== 数据层 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const clientsFile = path.join(DATA_DIR, 'clients.json');
const usersFile = path.join(DATA_DIR, 'users.json');
const authCodesFile = path.join(DATA_DIR, 'auth_codes.json');
const tokensFile = path.join(DATA_DIR, 'tokens.json');

function loadClients() {
  return readJson(clientsFile);
}
function saveClients(data) {
  writeJson(clientsFile, data);
}
function loadUsers() {
  return readJson(usersFile);
}
function saveUsers(data) {
  writeJson(usersFile, data);
}
function loadAuthCodes() {
  return readJson(authCodesFile);
}
function saveAuthCodes(data) {
  writeJson(authCodesFile, data);
}
function loadTokens() {
  return readJson(tokensFile);
}
function saveTokens(data) {
  writeJson(tokensFile, data);
}

// ==================== 工具函数 ====================

function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateAuthCode() {
  return crypto.randomBytes(24).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        // 支持 application/json 和 application/x-www-form-urlencoded
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(body ? JSON.parse(body) : {});
        } else {
          // 解析 form-urlencoded
          if (!body) return resolve({});
          const params = {};
          body.split('&').forEach((pair) => {
            const [key, val] = pair.split('=');
            if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
          });
          resolve(params);
        }
      } catch {
        reject(new Error('无效的请求数据'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendSuccess(res, data) {
  sendJson(res, 200, { success: true, data });
}

function sendError(res, status, error) {
  sendJson(res, status, { success: false, error });
}

function parsePath(requestUrl) {
  const parsed = url.parse(requestUrl, true);
  return parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
}

// ==================== CORS 处理 ====================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }
  return false;
}

// ==================== 密码工具 ====================

const HASH_ALGORITHM = 'sha512';
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const computed = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');
  return computed === hash;
}

// ==================== PKCE 工具 ====================

function verifyCodeChallenge(codeVerifier, codeChallenge, method) {
  if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
  // plain
  return codeVerifier === codeChallenge;
}

// ==================== 令牌工具 ====================

function createAccessToken(userId, clientId, scope) {
  const token = generateToken();
  const now = Math.floor(Date.now() / 1000);
  const tokenData = {
    token,
    type: 'access_token',
    userId,
    clientId,
    scope,
    createdAt: now,
    expiresAt: now + ACCESS_TOKEN_EXPIRY,
    revoked: false,
  };
  const tokens = loadTokens();
  tokens.push(tokenData);
  saveTokens(tokens);
  return tokenData;
}

function createRefreshToken(userId, clientId, scope) {
  const token = generateToken();
  const now = Math.floor(Date.now() / 1000);
  const tokenData = {
    token,
    type: 'refresh_token',
    userId,
    clientId,
    scope,
    createdAt: now,
    expiresAt: now + REFRESH_TOKEN_EXPIRY,
    revoked: false,
  };
  const tokens = loadTokens();
  tokens.push(tokenData);
  saveTokens(tokens);
  return tokenData;
}

function validateAccessToken(tokenStr) {
  const tokens = loadTokens();
  const now = Math.floor(Date.now() / 1000);
  const token = tokens.find(
    (t) => t.token === tokenStr && t.type === 'access_token' && !t.revoked && t.expiresAt > now
  );
  if (!token) return null;
  return token;
}

function validateRefreshToken(tokenStr) {
  const tokens = loadTokens();
  const now = Math.floor(Date.now() / 1000);
  const token = tokens.find(
    (t) => t.token === tokenStr && t.type === 'refresh_token' && !t.revoked && t.expiresAt > now
  );
  if (!token) return null;
  return token;
}

function revokeToken(tokenStr) {
  const tokens = loadTokens();
  const idx = tokens.findIndex((t) => t.token === tokenStr);
  if (idx === -1) return false;
  tokens[idx].revoked = true;
  saveTokens(tokens);
  return true;
}

// ==================== 授权码工具 ====================

function createAuthCode(userId, clientId, redirectUri, scope, codeChallenge, codeChallengeMethod) {
  const code = generateAuthCode();
  const now = Math.floor(Date.now() / 1000);
  const codeData = {
    code,
    userId,
    clientId,
    redirectUri,
    scope,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: codeChallengeMethod || null,
    createdAt: now,
    expiresAt: now + AUTH_CODE_EXPIRY,
    used: false,
  };
  const codes = loadAuthCodes();
  codes.push(codeData);
  saveAuthCodes(codes);
  return code;
}

function validateAuthCode(code, clientId, redirectUri, codeVerifier) {
  const codes = loadAuthCodes();
  const now = Math.floor(Date.now() / 1000);
  const codeData = codes.find(
    (c) => c.code === code && c.clientId === clientId && !c.used && c.expiresAt > now
  );
  if (!codeData) return null;
  if (codeData.redirectUri !== redirectUri) return null;
  // PKCE 验证
  if (codeData.codeChallenge) {
    if (!codeVerifier) return null;
    if (!verifyCodeChallenge(codeVerifier, codeData.codeChallenge, codeData.codeChallengeMethod))
      return null;
  }
  // 标记已使用
  const idx = codes.findIndex((c) => c.code === code);
  codes[idx].used = true;
  saveAuthCodes(codes);
  return codeData;
}

// ==================== 客户端管理 ====================

function findClient(clientId) {
  const clients = loadClients();
  return clients.find((c) => c.clientId === clientId) || null;
}

function authenticateClient(clientId, clientSecret) {
  const client = findClient(clientId);
  if (!client) return null;
  if (client.clientSecret !== clientSecret) return null;
  return client;
}

// ==================== 用户管理 ====================

function findUser(username) {
  const users = loadUsers();
  return users.find((u) => u.username === username) || null;
}

function findUserById(id) {
  const users = loadUsers();
  return users.find((u) => u.id === id) || null;
}

function authenticateUser(username, password) {
  const user = findUser(username);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

// ==================== 认证中间件 ====================

function requireAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { authenticated: false, error: '缺少访问令牌' };
  const tokenData = validateAccessToken(token);
  if (!tokenData) return { authenticated: false, error: '无效或已过期的访问令牌' };
  return { authenticated: true, token: tokenData };
}

// ==================== 限流器 ====================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1分钟
const RATE_LIMIT_MAX = 60;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now - record.startTime > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { startTime: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= RATE_LIMIT_MAX;
}

// ==================== 授权页面 ====================

function renderConsentPage(client, user, scope, state, redirectUri) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>OAuth2 授权确认</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 420px; width: 100%; }
    h2 { margin-top: 0; color: #333; }
    .info { color: #666; margin: 16px 0; }
    .scope-list { background: #f8f9fa; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
    .scope-item { padding: 4px 0; color: #444; }
    .scope-item::before { content: "✓ "; color: #4caf50; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; }
    .btn { padding: 10px 24px; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; flex: 1; }
    .btn-approve { background: #1976d2; color: white; }
    .btn-deny { background: #e0e0e0; color: #333; }
  </style>
</head>
<body>
  <div class="card">
    <h2>授权请求</h2>
    <p class="info"><strong>${client.clientName}</strong> 请求访问你的账户</p>
    <p class="info">登录用户: <strong>${user.username}</strong></p>
    <div class="scope-list">
      <div style="margin-bottom:8px;color:#888;font-size:13px;">请求的权限范围:</div>
      ${scope
        .split(' ')
        .filter(Boolean)
        .map((s) => `<div class="scope-item">${s}</div>`)
        .join('\n')}
    </div>
    <form method="POST" action="/api/oauth/authorize">
      <input type="hidden" name="client_id" value="${client.clientId}">
      <input type="hidden" name="user_id" value="${user.id}">
      <input type="hidden" name="scope" value="${scope}">
      <input type="hidden" name="state" value="${state || ''}">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="btn btn-deny">拒绝</button>
        <button type="submit" name="action" value="approve" class="btn btn-approve">授权</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

// ==================== 路由处理 ====================

// --- 客户端管理 API ---

async function registerClient(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const body = await parseBody(req);
  const { clientName, redirectUris, grantTypes, scopes } = body;

  if (!clientName) return sendError(res, 400, '客户端名称不能为空');

  const clientId = generateId();
  const clientSecret = generateSecret();
  const client = {
    clientId,
    clientSecret,
    clientName,
    redirectUris: redirectUris || [],
    grantTypes: grantTypes || ['authorization_code'],
    scopes: scopes || ['read', 'write'],
    createdAt: new Date().toISOString(),
  };

  const clients = loadClients();
  clients.push(client);
  saveClients(clients);

  sendJson(res, 201, {
    success: true,
    data: {
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
      grantTypes: client.grantTypes,
      scopes: client.scopes,
    },
  });
}

function listClients(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const clients = loadClients().map((c) => ({
    clientId: c.clientId,
    clientName: c.clientName,
    redirectUris: c.redirectUris,
    grantTypes: c.grantTypes,
    scopes: c.scopes,
    createdAt: c.createdAt,
  }));

  sendSuccess(res, clients);
}

function deleteClient(req, res, clientId) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const clients = loadClients();
  const idx = clients.findIndex((c) => c.clientId === clientId);
  if (idx === -1) return sendError(res, 404, '客户端不存在');

  clients.splice(idx, 1);
  saveClients(clients);
  sendSuccess(res, { message: '客户端已删除' });
}

// --- 用户管理 API ---

async function registerUser(req, res) {
  const body = await parseBody(req);
  const { username, password, email } = body;

  if (!username || !password) return sendError(res, 400, '用户名和密码不能为空');
  if (findUser(username)) return sendError(res, 409, '用户名已存在');

  const user = {
    id: generateId(),
    username,
    passwordHash: hashPassword(password),
    email: email || '',
    createdAt: new Date().toISOString(),
  };

  const users = loadUsers();
  users.push(user);
  saveUsers(users);

  sendJson(res, 201, {
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
}

function listUsers(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const users = loadUsers().map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
  }));

  sendSuccess(res, users);
}

// --- OAuth2 授权端点 ---

async function authorizeEndpoint(req, res) {
  if (req.method === 'GET') {
    // 展示授权确认页面
    const parsedUrl = url.parse(req.url, true);
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = parsedUrl.query;

    if (!response_type) return sendError(res, 400, '缺少 response_type 参数');
    if (!client_id) return sendError(res, 400, '缺少 client_id 参数');

    const client = findClient(client_id);
    if (!client) return sendError(res, 400, '无效的 client_id');

    if (response_type === 'code') {
      if (!redirect_uri) return sendError(res, 400, '缺少 redirect_uri 参数');
      if (client.redirectUris.length > 0 && !client.redirectUris.includes(redirect_uri)) {
        return sendError(res, 400, 'redirect_uri 不匹配');
      }
    } else if (response_type === 'token') {
      // Implicit 流程
      if (!redirect_uri) return sendError(res, 400, '缺少 redirect_uri 参数');
    } else {
      return sendError(res, 400, '不支持的 response_type');
    }

    // 简化处理: 自动使用第一个用户进行演示
    const users = loadUsers();
    if (users.length === 0) return sendError(res, 500, '系统中没有用户');
    const user = users[0];

    const requestScope = scope || client.scopes.join(' ');
    const html = renderConsentPage(client, user, requestScope, state, redirect_uri);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (req.method === 'POST') {
    // 处理授权确认
    const body = await parseBody(req);
    const {
      client_id,
      user_id,
      scope,
      state,
      redirect_uri,
      action,
      code_challenge,
      code_challenge_method,
    } = body;

    if (action === 'deny') {
      const denyUrl = `${redirect_uri}?error=access_denied&error_description=用户拒绝授权${state ? '&state=' + state : ''}`;
      res.writeHead(302, { Location: denyUrl });
      return res.end();
    }

    const client = findClient(client_id);
    if (!client) return sendError(res, 400, '无效的 client_id');

    if (client.grantTypes.includes('authorization_code')) {
      const code = createAuthCode(
        user_id,
        client_id,
        redirect_uri,
        scope,
        code_challenge,
        code_challenge_method
      );
      const redirectUrl = `${redirect_uri}?code=${code}${state ? '&state=' + state : ''}`;
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    } else if (client.grantTypes.includes('implicit')) {
      // Implicit: 直接返回 token 在 fragment 中
      const tokenData = createAccessToken(user_id, client_id, scope);
      const fragment = `access_token=${tokenData.token}&token_type=Bearer&expires_in=${ACCESS_TOKEN_EXPIRY}&scope=${encodeURIComponent(scope)}${state ? '&state=' + state : ''}`;
      const redirectUrl = `${redirect_uri}#${fragment}`;
      res.writeHead(302, { Location: redirectUrl });
      return res.end();
    }

    sendError(res, 400, '不支持的授权类型');
  }
}

// --- OAuth2 令牌端点 ---

async function tokenEndpoint(req, res) {
  // 限流
  const clientIp = req.socket.remoteAddress;
  if (!checkRateLimit(`token:${clientIp}`)) {
    return sendError(res, 429, '请求过于频繁，请稍后再试');
  }

  const body = await parseBody(req);
  const {
    grant_type,
    code,
    redirect_uri,
    client_id,
    client_secret,
    username,
    password,
    scope,
    refresh_token,
    code_verifier,
  } = body;

  // 客户端认证 (Authorization Header 或 body)
  let client = null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [cid, csecret] = decoded.split(':');
    client = authenticateClient(cid, csecret);
  } else if (client_id && client_secret) {
    client = authenticateClient(client_id, client_secret);
  }

  switch (grant_type) {
    case 'authorization_code': {
      if (!client) return sendError(res, 401, '客户端认证失败');
      if (!code) return sendError(res, 400, '缺少授权码');
      if (!redirect_uri) return sendError(res, 400, '缺少 redirect_uri');

      const codeData = validateAuthCode(code, client.clientId, redirect_uri, code_verifier);
      if (!codeData) return sendError(res, 400, '无效或已过期的授权码');

      const accessToken = createAccessToken(codeData.userId, client.clientId, codeData.scope);
      const refreshToken = createRefreshToken(codeData.userId, client.clientId, codeData.scope);

      sendJson(res, 200, {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        refresh_token: refreshToken.token,
        scope: codeData.scope,
      });
      break;
    }

    case 'client_credentials': {
      if (!client) return sendError(res, 401, '客户端认证失败');
      const requestScope = scope || client.scopes.join(' ');
      const accessToken = createAccessToken(null, client.clientId, requestScope);

      sendJson(res, 200, {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        scope: requestScope,
      });
      break;
    }

    case 'password': {
      if (!client) return sendError(res, 401, '客户端认证失败');
      if (!username || !password) return sendError(res, 400, '缺少用户名或密码');

      const user = authenticateUser(username, password);
      if (!user) return sendError(res, 401, '用户名或密码错误');

      const requestScope = scope || client.scopes.join(' ');
      const accessToken = createAccessToken(user.id, client.clientId, requestScope);
      const refreshToken = createRefreshToken(user.id, client.clientId, requestScope);

      sendJson(res, 200, {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        refresh_token: refreshToken.token,
        scope: requestScope,
      });
      break;
    }

    case 'refresh_token': {
      if (!client) return sendError(res, 401, '客户端认证失败');
      if (!refresh_token) return sendError(res, 400, '缺少 refresh_token');

      const tokenData = validateRefreshToken(refresh_token);
      if (!tokenData) return sendError(res, 400, '无效或已过期的刷新令牌');
      if (tokenData.clientId !== client.clientId) return sendError(res, 400, '令牌与客户端不匹配');

      // 撤销旧的刷新令牌
      revokeToken(refresh_token);

      // 签发新的令牌
      const accessToken = createAccessToken(tokenData.userId, client.clientId, tokenData.scope);
      const newRefreshToken = createRefreshToken(
        tokenData.userId,
        client.clientId,
        tokenData.scope
      );

      sendJson(res, 200, {
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY,
        refresh_token: newRefreshToken.token,
        scope: tokenData.scope,
      });
      break;
    }

    default:
      sendError(res, 400, `不支持的 grant_type: ${grant_type}`);
  }
}

// --- 令牌自省 ---

async function introspectEndpoint(req, res) {
  const body = await parseBody(req);
  const { token } = body;

  if (!token) return sendError(res, 400, '缺少 token 参数');

  // 客户端认证
  let client = null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [cid, csecret] = decoded.split(':');
    client = authenticateClient(cid, csecret);
  }
  if (!client) {
    // 也接受 Bearer token 认证
    const auth = requireAuth(req);
    if (!auth.authenticated) return sendError(res, 401, '需要客户端认证');
  }

  const tokens = loadTokens();
  const now = Math.floor(Date.now() / 1000);
  const tokenData = tokens.find((t) => t.token === token);

  if (!tokenData || tokenData.revoked || tokenData.expiresAt <= now) {
    return sendJson(res, 200, { active: false });
  }

  sendJson(res, 200, {
    active: true,
    token_type: tokenData.type === 'access_token' ? 'Bearer' : 'refresh_token',
    scope: tokenData.scope,
    client_id: tokenData.clientId,
    username: tokenData.userId ? findUserById(tokenData.userId)?.username || null : null,
    exp: tokenData.expiresAt,
    iat: tokenData.createdAt,
  });
}

// --- 令牌撤销 ---

async function revokeEndpoint(req, res) {
  const body = await parseBody(req);
  const { token } = body;

  if (!token) return sendError(res, 400, '缺少 token 参数');

  // 客户端认证
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [cid, csecret] = decoded.split(':');
    const client = authenticateClient(cid, csecret);
    if (!client) return sendError(res, 401, '客户端认证失败');
  }

  revokeToken(token);
  sendJson(res, 200, { success: true });
}

// --- 用户信息端点 ---

function userinfoEndpoint(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const tokenData = auth.token;
  if (!tokenData.userId) return sendError(res, 400, '该令牌不关联用户');

  const user = findUserById(tokenData.userId);
  if (!user) return sendError(res, 404, '用户不存在');

  sendSuccess(res, {
    id: user.id,
    username: user.username,
    email: user.email,
    scope: tokenData.scope,
    createdAt: user.createdAt,
  });
}

// --- 健康检查 ---

function healthCheck(req, res) {
  sendSuccess(res, {
    service: 'OAuth2 认证服务',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// --- 系统信息 ---

function systemInfo(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendError(res, 401, auth.error);

  const clients = loadClients();
  const users = loadUsers();
  const tokens = loadTokens();
  const now = Math.floor(Date.now() / 1000);
  const activeTokens = tokens.filter((t) => !t.revoked && t.expiresAt > now);

  sendSuccess(res, {
    service: 'OAuth2 认证服务',
    totalClients: clients.length,
    totalUsers: users.length,
    activeTokens: activeTokens.filter((t) => t.type === 'access_token').length,
    activeRefreshTokens: activeTokens.filter((t) => t.type === 'refresh_token').length,
    supportedGrantTypes: ['authorization_code', 'client_credentials', 'password', 'refresh_token'],
    accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: REFRESH_TOKEN_EXPIRY,
  });
}

// ==================== 请求路由 ====================

async function handleRequest(req, res) {
  // CORS
  if (handleCors(req, res)) return;

  // 设置 CORS 头
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const method = req.method;
  const segments = parsePath(req.url);

  try {
    // 健康检查
    if (segments.length === 1 && segments[0] === 'health' && method === 'GET') {
      return healthCheck(req, res);
    }

    // OAuth2 授权端点
    if (segments[0] === 'api' && segments[1] === 'oauth' && segments[2] === 'authorize') {
      return await authorizeEndpoint(req, res);
    }

    // OAuth2 令牌端点
    if (
      segments[0] === 'api' &&
      segments[1] === 'oauth' &&
      segments[2] === 'token' &&
      method === 'POST'
    ) {
      return await tokenEndpoint(req, res);
    }

    // 令牌自省
    if (
      segments[0] === 'api' &&
      segments[1] === 'oauth' &&
      segments[2] === 'introspect' &&
      method === 'POST'
    ) {
      return await introspectEndpoint(req, res);
    }

    // 令牌撤销
    if (
      segments[0] === 'api' &&
      segments[1] === 'oauth' &&
      segments[2] === 'revoke' &&
      method === 'POST'
    ) {
      return await revokeEndpoint(req, res);
    }

    // 用户信息
    if (segments[0] === 'api' && segments[1] === 'userinfo' && method === 'GET') {
      return userinfoEndpoint(req, res);
    }

    // 客户端管理
    if (segments[0] === 'api' && segments[1] === 'clients') {
      if (method === 'GET') return listClients(req, res);
      if (method === 'POST') return await registerClient(req, res);
      if (method === 'DELETE' && segments[2]) return deleteClient(req, res, segments[2]);
    }

    // 用户管理
    if (segments[0] === 'api' && segments[1] === 'users') {
      if (method === 'GET') return listUsers(req, res);
      if (method === 'POST') return await registerUser(req, res);
    }

    // 系统信息
    if (segments[0] === 'api' && segments[1] === 'system' && method === 'GET') {
      return systemInfo(req, res);
    }

    sendError(res, 404, '接口不存在');
  } catch (err) {
    console.error('请求处理错误:', err);
    sendError(res, 500, '服务器内部错误');
  }
}

// ==================== 初始化默认数据 ====================

function initDefaultData() {
  // 默认管理员用户
  const users = loadUsers();
  if (users.length === 0) {
    users.push({
      id: generateId(),
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      email: 'admin@example.com',
      createdAt: new Date().toISOString(),
    });
    users.push({
      id: generateId(),
      username: 'user1',
      passwordHash: hashPassword('pass123'),
      email: 'user1@example.com',
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
  }

  // 默认 OAuth2 客户端
  const clients = loadClients();
  if (clients.length === 0) {
    clients.push({
      clientId: 'webapp',
      clientSecret: 'webapp_secret',
      clientName: 'Web 应用客户端',
      redirectUris: ['http://localhost:3000/callback', 'http://localhost:8080/callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['read', 'write', 'profile'],
      createdAt: new Date().toISOString(),
    });
    clients.push({
      clientId: 'mobileapp',
      clientSecret: 'mobile_secret',
      clientName: '移动端客户端 (PKCE)',
      redirectUris: ['myapp://callback'],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['read', 'profile'],
      createdAt: new Date().toISOString(),
    });
    clients.push({
      clientId: 'service_bot',
      clientSecret: 'bot_secret',
      clientName: '服务间调用客户端',
      redirectUris: [],
      grantTypes: ['client_credentials'],
      scopes: ['read', 'write'],
      createdAt: new Date().toISOString(),
    });
    clients.push({
      clientId: 'legacy_app',
      clientSecret: 'legacy_secret',
      clientName: '遗留应用 (密码模式)',
      redirectUris: [],
      grantTypes: ['password', 'refresh_token'],
      scopes: ['read'],
      createdAt: new Date().toISOString(),
    });
    saveClients(clients);
  }
}

// ==================== 启动服务器 ====================

initDefaultData();

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║         OAuth2 认证服务已启动                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log('');
  console.log('  OAuth2 端点:');
  console.log('  ├─ GET  /api/oauth/authorize     授权端点');
  console.log('  ├─ POST /api/oauth/token          令牌端点');
  console.log('  ├─ POST /api/oauth/introspect     令牌自省');
  console.log('  └─ POST /api/oauth/revoke         令牌撤销');
  console.log('');
  console.log('  用户信息:');
  console.log('  └─ GET  /api/userinfo             用户信息端点');
  console.log('');
  console.log('  管理接口:');
  console.log('  ├─ GET  /api/clients              客户端列表');
  console.log('  ├─ POST /api/clients              注册客户端');
  console.log('  ├─ DELETE /api/clients/:id         删除客户端');
  console.log('  ├─ GET  /api/users                用户列表');
  console.log('  ├─ POST /api/users                注册用户');
  console.log('  └─ GET  /api/system               系统信息');
  console.log('');
  console.log('  支持的授权类型:');
  console.log('  ├─ authorization_code  授权码模式');
  console.log('  ├─ client_credentials  客户端凭证模式');
  console.log('  ├─ password            密码模式');
  console.log('  └─ refresh_token       刷新令牌');
  console.log('');
  console.log('  默认用户:');
  console.log('  ├─ admin / admin123');
  console.log('  └─ user1 / pass123');
  console.log('');
  console.log('  默认客户端:');
  console.log('  ├─ webapp / webapp_secret        (授权码模式)');
  console.log('  ├─ mobileapp / mobile_secret      (授权码+PKCE)');
  console.log('  ├─ service_bot / bot_secret       (客户端凭证)');
  console.log('  └─ legacy_app / legacy_secret     (密码模式)');
  console.log('');
  console.log('  健康检查: http://localhost:' + PORT + '/health');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭 OAuth2 认证服务...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
