const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

// ─── 配置 ──────────────────────────────────────────────────────
const PORT = 3600;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const API_KEYS_FILE = path.join(DATA_DIR, "apikeys.json");

const JWT_SECRET = "jwt-auth-server-secret-change-in-prod";
const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";
const API_KEY_EXPIRES = "365d";

// 密码哈希
const HASH_ALGORITHM = "sha512";
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

// 限流配置
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 分钟
const RATE_LIMIT_MAX = 60; // 每分钟最多 60 次请求

// ─── 数据层 ──────────────────────────────────────────────────────

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  ensureDir(file);
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf-8");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJson(file, data) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ─── 通用工具 ──────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("无效的 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parsePath(reqUrl) {
  const pathname = url.parse(reqUrl).pathname.replace(/^\/|\/$/g, "");
  return pathname.split("/");
}

function parseQuery(reqUrl) {
  return url.parse(reqUrl, true).query;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractBearerToken(req) {
  const h = req.headers["authorization"];
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7);
}

function extractApiKey(req) {
  // 优先从 header 取
  const fromHeader = req.headers["x-api-key"];
  if (fromHeader) return fromHeader;
  // 其次从 query 取
  const query = parseQuery(req.url);
  return query.apikey || null;
}

// ─── 密码工具 ──────────────────────────────────────────────────────

function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString("hex");
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, HASH_ALGORITHM).toString("hex");
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}

// ─── JWT 核心（纯 Node.js 实现，支持多种算法）──────────────────────────

/** 解析过期时间字符串为秒数 */
function parseExpiry(expiry) {
  if (typeof expiry === "number") return expiry;
  const m = String(expiry).match(/^(\d+)(s|m|h|d)$/);
  if (!m) return 900;
  const v = parseInt(m[1]);
  const u = m[2];
  return v * ({ s: 1, m: 60, h: 3600, d: 86400 }[u] || 1);
}

/** Base64URL 编码 */
function b64UrlEncode(data) {
  return Buffer.from(typeof data === "string" ? data : JSON.stringify(data))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Base64URL 解码为字符串 */
function b64UrlDecode(str) {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

/** Base64URL 解码为 JSON */
function b64UrlDecodeJson(str) {
  return JSON.parse(b64UrlDecode(str));
}

/**
 * 签名算法映射
 * 支持 HS256, HS384, HS512 (HMAC)
 *       RS256, RS384, RS512 (RSA-SHA)
 */
const ALGO_MAP = {
  HS256: "sha256",
  HS384: "sha384",
  HS512: "sha512",
  RS256: "RSA-SHA256",
  RS384: "RSA-SHA384",
  RS512: "RSA-SHA512",
};

/** 获取签名密钥（HMAC 用 secret，RSA 用私钥） */
function getSigningKey(algorithm) {
  const rsaAlgos = ["RS256", "RS384", "RS512"];
  if (rsaAlgos.includes(algorithm)) {
    // 生产环境从文件加载 RSA 私钥，这里用 demo 密钥对
    const keyPath = path.join(DATA_DIR, "rsa_private.pem");
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, "utf-8");
    }
    // 自动生成 RSA 密钥对
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privPem = privateKey.export({ type: "pkcs1", format: "pem" });
    const pubPem = publicKey.export({ type: "pkcs1", format: "pem" });
    ensureDir(keyPath);
    fs.writeFileSync(keyPath, privPem, "utf-8");
    fs.writeFileSync(path.join(DATA_DIR, "rsa_public.pem"), pubPem, "utf-8");
    return privPem;
  }
  return JWT_SECRET;
}

/** 获取验证密钥（RSA 用公钥） */
function getVerifyKey(algorithm) {
  const rsaAlgos = ["RS256", "RS384", "RS512"];
  if (rsaAlgos.includes(algorithm)) {
    const keyPath = path.join(DATA_DIR, "rsa_public.pem");
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, "utf-8");
    }
    // 触发生成
    getSigningKey(algorithm);
    return fs.readFileSync(keyPath, "utf-8");
  }
  return JWT_SECRET;
}

/** 生成签名 */
function createSignature(encodedHeader, encodedPayload, algorithm) {
  const key = getSigningKey(algorithm);
  const cryptoAlgo = ALGO_MAP[algorithm];
  if (!cryptoAlgo) throw new Error(`不支持的算法: ${algorithm}`);

  const isRsa = algorithm.startsWith("RS");
  const sign = crypto.createSign(cryptoAlgo);
  sign.update(`${encodedHeader}.${encodedPayload}`);

  if (isRsa) {
    return sign.sign(key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  } else {
    return crypto
      .createHmac(cryptoAlgo.replace("SHA", "sha"), key)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
}

/** 验证签名 */
function verifySignature(encodedHeader, encodedPayload, signature, algorithm) {
  const expected = createSignature(encodedHeader, encodedPayload, algorithm);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * 生成 JWT
 * @param {object} payload - 载荷数据
 * @param {string} expiresIn - 过期时间 (如 "15m", "7d", "3600s")
 * @param {string} algorithm - 签名算法 (默认 HS256)
 * @param {object} [options] - 额外选项
 */
function generateJwt(payload, expiresIn, algorithm = "HS256", options = {}) {
  if (!ALGO_MAP[algorithm]) throw new Error(`不支持的算法: ${algorithm}`);

  const header = { alg: algorithm, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiry(expiresIn);

  const jwtPayload = {
    ...payload,
    iat: now,
    exp,
    ...(options.jti !== false ? { jti: generateId() } : {}),
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.subject ? { sub: options.subject } : {}),
    ...(options.audience ? { aud: options.audience } : {}),
  };

  const encodedHeader = b64UrlEncode(header);
  const encodedPayload = b64UrlEncode(jwtPayload);
  const signature = createSignature(encodedHeader, encodedPayload, algorithm);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * 验证 JWT
 * @returns {{ valid: boolean, payload: object|null, header: object|null, error: string|null }}
 */
function verifyJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, payload: null, header: null, error: "JWT 格式错误" };

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = b64UrlDecodeJson(encodedHeader);

    if (!header.alg || !ALGO_MAP[header.alg]) {
      return { valid: false, payload: null, header, error: `不支持的算法: ${header.alg}` };
    }

    // 验证签名
    try {
      if (!verifySignature(encodedHeader, encodedPayload, signature, header.alg)) {
        return { valid: false, payload: null, header, error: "签名验证失败" };
      }
    } catch {
      return { valid: false, payload: null, header, error: "签名验证失败" };
    }

    // 解码 payload
    const payload = b64UrlDecodeJson(encodedPayload);

    // 检查过期
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, payload, header, error: "令牌已过期" };
    }

    // 检查 nbf (Not Before)
    if (payload.nbf && payload.nbf > now) {
      return { valid: false, payload, header, error: "令牌尚未生效" };
    }

    // 检查是否被撤销（黑名单）
    if (payload.jti && tokenBlacklist.has(payload.jti)) {
      return { valid: false, payload, header, error: "令牌已被撤销" };
    }

    return { valid: true, payload, header, error: null };
  } catch (e) {
    return { valid: false, payload: null, header: null, error: "令牌解析失败" };
  }
}

/**
 * 解码 JWT（不验证签名，仅解码）
 */
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return {
      header: b64UrlDecodeJson(parts[0]),
      payload: b64UrlDecodeJson(parts[1]),
      signature: parts[2],
    };
  } catch {
    return null;
  }
}

// ─── 令牌黑名单（撤销列表）──────────────────────────────────────

const tokenBlacklist = new Map(); // jti -> { revokedAt, expiresAt }

function revokeToken(jti, exp) {
  tokenBlacklist.set(jti, {
    revokedAt: Math.floor(Date.now() / 1000),
    expiresAt: exp || 0,
  });
}

function isTokenRevoked(jti) {
  return tokenBlacklist.has(jti);
}

// 定期清理过期的黑名单条目
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, entry] of tokenBlacklist) {
    if (entry.expiresAt && entry.expiresAt < now) {
      tokenBlacklist.delete(jti);
    }
  }
}, 60 * 1000);

// ─── 刷新令牌存储 ──────────────────────────────────────────────

const refreshTokens = new Map(); // userId -> Map<token, { createdAt, expiresAt, clientId }>

function storeRefreshToken(userId, token, clientId) {
  if (!refreshTokens.has(userId)) refreshTokens.set(userId, new Map());
  refreshTokens.get(userId).set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + parseExpiry(REFRESH_TOKEN_EXPIRES) * 1000,
    clientId: clientId || "default",
  });
}

function isValidRefreshToken(userId, token) {
  const userTokens = refreshTokens.get(userId);
  if (!userTokens) return false;
  const entry = userTokens.get(token);
  if (!entry) return false;
  return entry.expiresAt > Date.now();
}

function revokeRefreshToken(userId, token) {
  const userTokens = refreshTokens.get(userId);
  if (userTokens) userTokens.delete(token);
}

function revokeAllRefreshTokens(userId) {
  refreshTokens.delete(userId);
}

// ─── 客户端（应用）管理 ──────────────────────────────────────────

function readClients() { return readJson(CLIENTS_FILE); }
function writeClients(data) { writeJson(CLIENTS_FILE, data); }

// 初始化默认客户端
function initDefaultClient() {
  const clients = readClients();
  if (clients.length === 0) {
    clients.push({
      id: "default",
      name: "默认应用",
      secret: crypto.randomBytes(24).toString("hex"),
      redirectUris: [],
      createdAt: new Date().toISOString(),
    });
    writeClients(clients);
  }
}

// ─── API Key 管理 ──────────────────────────────────────────────

function readApiKeys() { return readJson(API_KEYS_FILE); }
function writeApiKeys(data) { writeJson(API_KEYS_FILE, data); }

function validateApiKey(keyValue) {
  const keys = readApiKeys();
  const found = keys.find((k) => k.key === keyValue && k.active);
  if (!found) return null;
  if (found.expiresAt && new Date(found.expiresAt) < new Date()) return null;
  // 更新最后使用时间
  found.lastUsedAt = new Date().toISOString();
  writeApiKeys(keys);
  return found;
}

// ─── 用户数据 ──────────────────────────────────────────────────

function readUsers() { return readJson(USERS_FILE); }
function writeUsers(data) { writeJson(USERS_FILE, data); }

// ─── 限流器 ──────────────────────────────────────────────────────

const rateLimiter = new Map(); // ip -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimiter.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimiter.set(ip, entry);
  }
  entry.count++;
  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt,
  };
}

// 定期清理限流记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (entry.resetAt < now) rateLimiter.delete(ip);
  }
}, 60 * 1000);

// ─── CORS 中间件 ──────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function handleCors(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }
  return false;
}

// ─── 认证中间件 ──────────────────────────────────────────────

/** 要求有效的 access token */
function requireAuth(req) {
  const token = extractBearerToken(req);
  if (!token) return { authenticated: false, error: "缺少访问令牌" };
  const result = verifyJwt(token);
  if (!result.valid) return { authenticated: false, error: result.error };
  return { authenticated: true, payload: result.payload };
}

/** 要求有效的 API Key */
function requireApiKey(req) {
  const keyValue = extractApiKey(req);
  if (!keyValue) return { authenticated: false, error: "缺少 API Key" };
  const keyObj = validateApiKey(keyValue);
  if (!keyObj) return { authenticated: false, error: "API Key 无效或已过期" };
  return { authenticated: true, apiKey: keyObj };
}

// ─── 路由处理器 ──────────────────────────────────────────────

/** POST /api/auth/register — 用户注册 */
async function handleRegister(req, res) {
  const body = await parseBody(req);

  if (!body.username || typeof body.username !== "string" || !body.username.trim()) {
    return sendJson(res, 400, { success: false, error: "username 为必填字段" });
  }
  if (!body.email || !isValidEmail(body.email)) {
    return sendJson(res, 400, { success: false, error: "email 格式不正确" });
  }
  if (!body.password || body.password.length < 6) {
    return sendJson(res, 400, { success: false, error: "password 至少需要 6 个字符" });
  }

  const users = readUsers();

  if (users.find((u) => u.username === body.username.trim())) {
    return sendJson(res, 409, { success: false, error: "用户名已被注册" });
  }
  if (users.find((u) => u.email === body.email.trim().toLowerCase())) {
    return sendJson(res, 409, { success: false, error: "邮箱已被注册" });
  }

  const salt = generateSalt();
  const hashedPwd = hashPassword(body.password, salt);
  const now = new Date().toISOString();

  const user = {
    id: generateId(),
    username: body.username.trim(),
    email: body.email.trim().toLowerCase(),
    password: `${salt}:${hashedPwd}`,
    nickname: body.nickname || body.username.trim(),
    roles: ["user"],
    avatar: null,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  writeUsers(users);

  const algorithm = body.algorithm || "HS256";
  const clientId = body.client_id || "default";

  const accessToken = generateJwt(
    { userId: user.id, username: user.username, roles: user.roles },
    ACCESS_TOKEN_EXPIRES,
    algorithm,
    { issuer: "jwt-auth-server", subject: user.id }
  );
  const refreshToken = crypto.randomBytes(40).toString("hex");
  storeRefreshToken(user.id, refreshToken, clientId);

  const { password: _, ...safeUser } = user;
  sendJson(res, 201, {
    success: true,
    data: {
      user: safeUser,
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
      algorithm,
    },
  });
}

/** POST /api/auth/login — 用户登录 */
async function handleLogin(req, res) {
  const body = await parseBody(req);

  if (!body.username || !body.password) {
    return sendJson(res, 400, { success: false, error: "username 和 password 为必填字段" });
  }

  const users = readUsers();
  const user = users.find((u) => u.username === body.username);

  if (!user) {
    return sendJson(res, 401, { success: false, error: "用户名或密码错误" });
  }

  const [salt, hashedPwd] = user.password.split(":");
  if (!verifyPassword(body.password, salt, hashedPwd)) {
    return sendJson(res, 401, { success: false, error: "用户名或密码错误" });
  }

  const algorithm = body.algorithm || "HS256";
  const clientId = body.client_id || "default";

  const accessToken = generateJwt(
    { userId: user.id, username: user.username, roles: user.roles },
    ACCESS_TOKEN_EXPIRES,
    algorithm,
    { issuer: "jwt-auth-server", subject: user.id }
  );
  const refreshToken = crypto.randomBytes(40).toString("hex");
  storeRefreshToken(user.id, refreshToken, clientId);

  user.updatedAt = new Date().toISOString();
  writeUsers(users);

  const { password: _, ...safeUser } = user;
  sendJson(res, 200, {
    success: true,
    data: {
      user: safeUser,
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
      algorithm,
    },
  });
}

/** POST /api/auth/refresh — 刷新令牌 */
async function handleRefresh(req, res) {
  const body = await parseBody(req);

  if (!body.refreshToken) {
    return sendJson(res, 400, { success: false, error: "refreshToken 为必填字段" });
  }

  // 从旧 accessToken 解析 userId
  let userId = null;
  const oldAccessToken = extractBearerToken(req);
  if (oldAccessToken) {
    const decoded = decodeJwt(oldAccessToken);
    if (decoded && decoded.payload) userId = decoded.payload.userId;
  }
  if (!userId && body.userId) userId = body.userId;

  if (!userId) {
    return sendJson(res, 401, { success: false, error: "无法识别用户，请重新登录" });
  }

  if (!isValidRefreshToken(userId, body.refreshToken)) {
    return sendJson(res, 401, { success: false, error: "刷新令牌无效或已过期，请重新登录" });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return sendJson(res, 401, { success: false, error: "用户不存在" });
  }

  // 轮换策略：撤销旧刷新令牌，发放新的
  revokeRefreshToken(userId, body.refreshToken);

  const algorithm = body.algorithm || "HS256";
  const clientId = body.client_id || "default";

  const accessToken = generateJwt(
    { userId: user.id, username: user.username, roles: user.roles },
    ACCESS_TOKEN_EXPIRES,
    algorithm,
    { issuer: "jwt-auth-server", subject: user.id }
  );
  const newRefreshToken = crypto.randomBytes(40).toString("hex");
  storeRefreshToken(user.id, newRefreshToken, clientId);

  sendJson(res, 200, {
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: parseExpiry(ACCESS_TOKEN_EXPIRES),
    },
  });
}

/** POST /api/auth/logout — 登出 */
async function handleLogout(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);

  // 将当前 access token 加入黑名单
  if (auth.payload.jti) {
    revokeToken(auth.payload.jti, auth.payload.exp);
  }

  // 撤销刷新令牌
  if (body.refreshToken) {
    revokeRefreshToken(auth.payload.userId, body.refreshToken);
  } else {
    revokeAllRefreshTokens(auth.payload.userId);
  }

  sendJson(res, 200, { success: true, data: { message: "已成功登出" } });
}

/** GET /api/auth/profile — 获取当前用户信息 */
function handleGetProfile(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const users = readUsers();
  const user = users.find((u) => u.id === auth.payload.userId);
  if (!user) return sendJson(res, 404, { success: false, error: "用户不存在" });

  const { password: _, ...safeUser } = user;
  sendJson(res, 200, { success: true, data: safeUser });
}

/** PUT /api/auth/profile — 更新用户信息 */
async function handleUpdateProfile(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === auth.payload.userId);
  if (idx === -1) return sendJson(res, 404, { success: false, error: "用户不存在" });

  const user = users[idx];

  if (body.nickname !== undefined) {
    if (!body.nickname.trim()) return sendJson(res, 400, { success: false, error: "nickname 不能为空" });
    user.nickname = body.nickname.trim();
  }
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) return sendJson(res, 400, { success: false, error: "email 格式不正确" });
    const newEmail = body.email.trim().toLowerCase();
    if (newEmail !== user.email && users.find((u) => u.email === newEmail)) {
      return sendJson(res, 409, { success: false, error: "邮箱已被使用" });
    }
    user.email = newEmail;
  }
  if (body.avatar !== undefined) user.avatar = body.avatar;

  if (body.oldPassword && body.newPassword) {
    const [salt, hash] = user.password.split(":");
    if (!verifyPassword(body.oldPassword, salt, hash)) {
      return sendJson(res, 401, { success: false, error: "旧密码不正确" });
    }
    if (body.newPassword.length < 6) {
      return sendJson(res, 400, { success: false, error: "新密码至少需要 6 个字符" });
    }
    const newSalt = generateSalt();
    user.password = `${newSalt}:${hashPassword(body.newPassword, newSalt)}`;
    revokeAllRefreshTokens(user.id);
  }

  user.updatedAt = new Date().toISOString();
  users[idx] = user;
  writeUsers(users);

  const { password: _, ...safeUser } = user;
  sendJson(res, 200, { success: true, data: safeUser });
}

/** POST /api/auth/change-password — 修改密码 */
async function handleChangePassword(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);
  if (!body.oldPassword || !body.newPassword) {
    return sendJson(res, 400, { success: false, error: "oldPassword 和 newPassword 为必填字段" });
  }
  if (body.newPassword.length < 6) {
    return sendJson(res, 400, { success: false, error: "新密码至少需要 6 个字符" });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === auth.payload.userId);
  if (!user) return sendJson(res, 404, { success: false, error: "用户不存在" });

  const [salt, hash] = user.password.split(":");
  if (!verifyPassword(body.oldPassword, salt, hash)) {
    return sendJson(res, 401, { success: false, error: "旧密码不正确" });
  }

  const newSalt = generateSalt();
  user.password = `${newSalt}:${hashPassword(body.newPassword, newSalt)}`;
  user.updatedAt = new Date().toISOString();
  writeUsers(users);

  // 撤销该用户所有刷新令牌
  revokeAllRefreshTokens(user.id);

  // 将当前 access token 加入黑名单
  if (auth.payload.jti) revokeToken(auth.payload.jti, auth.payload.exp);

  sendJson(res, 200, { success: true, data: { message: "密码修改成功，请重新登录" } });
}

// ─── JWT 工具端点 ──────────────────────────────────────────────

/** POST /api/jwt/generate — 自定义生成 JWT */
async function handleJwtGenerate(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);

  const algorithm = body.algorithm || "HS256";
  const expiresIn = body.expiresIn || "1h";
  const payload = body.payload || {};

  // 不允许覆盖系统字段
  delete payload.iat;
  delete payload.exp;
  delete payload.jti;

  const options = {};
  if (body.issuer) options.issuer = body.issuer;
  if (body.subject) options.subject = body.subject;
  if (body.audience) options.audience = body.audience;

  try {
    const token = generateJwt(payload, expiresIn, algorithm, options);
    const decoded = decodeJwt(token);
    sendJson(res, 200, {
      success: true,
      data: {
        token,
        decoded,
        algorithm,
        expiresIn: parseExpiry(expiresIn),
      },
    });
  } catch (e) {
    sendJson(res, 400, { success: false, error: e.message });
  }
}

/** POST /api/jwt/verify — 验证 JWT */
async function handleJwtVerify(req, res) {
  const body = await parseBody(req);
  if (!body.token) return sendJson(res, 400, { success: false, error: "token 为必填字段" });

  const result = verifyJwt(body.token);
  sendJson(res, 200, {
    success: true,
    data: {
      valid: result.valid,
      header: result.header,
      payload: result.payload,
      error: result.error,
    },
  });
}

/** POST /api/jwt/decode — 解码 JWT（不验证签名） */
async function handleJwtDecode(req, res) {
  const body = await parseBody(req);
  if (!body.token) return sendJson(res, 400, { success: false, error: "token 为必填字段" });

  const decoded = decodeJwt(body.token);
  if (!decoded) return sendJson(res, 400, { success: false, error: "无法解码令牌" });

  sendJson(res, 200, { success: true, data: decoded });
}

/** POST /api/jwt/revoke — 撤销 JWT */
async function handleJwtRevoke(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);
  if (!body.token) return sendJson(res, 400, { success: false, error: "token 为必填字段" });

  const decoded = decodeJwt(body.token);
  if (!decoded || !decoded.payload || !decoded.payload.jti) {
    return sendJson(res, 400, { success: false, error: "令牌不包含 jti，无法撤销" });
  }

  revokeToken(decoded.payload.jti, decoded.payload.exp);
  sendJson(res, 200, { success: true, data: { message: "令牌已撤销", jti: decoded.payload.jti } });
}

/** POST /api/jwt/introspect — 令牌内省 (RFC 7662 风格) */
async function handleJwtIntrospect(req, res) {
  const body = await parseBody(req);
  if (!body.token) return sendJson(res, 400, { success: false, error: "token 为必填字段" });

  const result = verifyJwt(body.token);

  if (!result.valid) {
    return sendJson(res, 200, { active: false });
  }

  sendJson(res, 200, {
    active: true,
    alg: result.header.alg,
    typ: result.header.typ || "JWT",
    ...result.payload,
  });
}

// ─── API Key 管理 ──────────────────────────────────────────────

/** POST /api/keys — 创建 API Key */
async function handleCreateApiKey(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);
  if (!body.name || !body.name.trim()) {
    return sendJson(res, 400, { success: false, error: "name 为必填字段" });
  }

  const keys = readApiKeys();
  const keyValue = `ak_${crypto.randomBytes(24).toString("hex")}`;
  const now = new Date().toISOString();

  const apiKey = {
    id: generateId(),
    name: body.name.trim(),
    key: keyValue,
    userId: auth.payload.userId,
    active: true,
    permissions: body.permissions || [],
    expiresAt: body.expiresIn
      ? new Date(Date.now() + parseExpiry(body.expiresIn) * 1000).toISOString()
      : null,
    createdAt: now,
    lastUsedAt: null,
  };

  keys.push(apiKey);
  writeApiKeys(keys);

  sendJson(res, 201, { success: true, data: apiKey });
}

/** GET /api/keys — 列出当前用户的 API Keys */
function handleListApiKeys(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const keys = readApiKeys().filter((k) => k.userId === auth.payload.userId);
  // 不返回 key 值的完整形式，只显示前 8 位
  const safeKeys = keys.map((k) => ({
    ...k,
    key: k.key.slice(0, 11) + "..." + k.key.slice(-4),
  }));

  sendJson(res, 200, { success: true, data: safeKeys });
}

/** DELETE /api/keys/:id — 撤销 API Key */
function handleRevokeApiKey(req, res, keyId) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const keys = readApiKeys();
  const idx = keys.findIndex((k) => k.id === keyId && k.userId === auth.payload.userId);
  if (idx === -1) return sendJson(res, 404, { success: false, error: "API Key 不存在" });

  keys[idx].active = false;
  writeApiKeys(keys);

  sendJson(res, 200, { success: true, data: { message: "API Key 已撤销" } });
}

// ─── 客户端管理 ──────────────────────────────────────────────

/** GET /api/clients — 列出客户端 */
function handleListClients(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const clients = readClients();
  const safeClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    redirectUris: c.redirectUris,
    createdAt: c.createdAt,
  }));

  sendJson(res, 200, { success: true, data: safeClients });
}

/** POST /api/clients — 创建客户端 */
async function handleCreateClient(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const body = await parseBody(req);
  if (!body.name || !body.name.trim()) {
    return sendJson(res, 400, { success: false, error: "name 为必填字段" });
  }

  const clients = readClients();
  const client = {
    id: generateId(),
    name: body.name.trim(),
    secret: crypto.randomBytes(24).toString("hex"),
    redirectUris: body.redirectUris || [],
    createdAt: new Date().toISOString(),
  };

  clients.push(client);
  writeClients(clients);

  sendJson(res, 201, { success: true, data: client });
}

/** DELETE /api/clients/:id — 删除客户端 */
function handleDeleteClient(req, res, clientId) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  const clients = readClients();
  const idx = clients.findIndex((c) => c.id === clientId);
  if (idx === -1) return sendJson(res, 404, { success: false, error: "客户端不存在" });

  clients.splice(idx, 1);
  writeClients(clients);

  sendJson(res, 200, { success: true, data: { message: "客户端已删除" } });
}

// ─── 管理端点 ──────────────────────────────────────────────

/** GET /api/admin/stats — 系统统计 */
function handleAdminStats(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  // 检查是否有 admin 角色
  if (!auth.payload.roles || !auth.payload.roles.includes("admin")) {
    return sendJson(res, 403, { success: false, error: "需要管理员权限" });
  }

  const users = readUsers();
  const clients = readClients();
  const apiKeys = readApiKeys();

  // 统计刷新令牌数
  let refreshCount = 0;
  for (const [, tokens] of refreshTokens) refreshCount += tokens.size;

  sendJson(res, 200, {
    success: true,
    data: {
      users: users.length,
      clients: clients.length,
      apiKeys: apiKeys.length,
      activeApiKeys: apiKeys.filter((k) => k.active).length,
      refreshTokens: refreshCount,
      blacklistedTokens: tokenBlacklist.size,
      rateLimitedIps: rateLimiter.size,
      supportedAlgorithms: Object.keys(ALGO_MAP),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  });
}

/** GET /api/admin/blacklist — 查看黑名单 */
function handleAdminBlacklist(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  if (!auth.payload.roles || !auth.payload.roles.includes("admin")) {
    return sendJson(res, 403, { success: false, error: "需要管理员权限" });
  }

  const list = [];
  for (const [jti, info] of tokenBlacklist) {
    list.push({ jti, ...info });
  }

  sendJson(res, 200, { success: true, data: list });
}

/** DELETE /api/admin/blacklist/:jti — 从黑名单移除 */
function handleAdminUnblacklist(req, res, jti) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  if (!auth.payload.roles || !auth.payload.roles.includes("admin")) {
    return sendJson(res, 403, { success: false, error: "需要管理员权限" });
  }

  if (!tokenBlacklist.has(jti)) {
    return sendJson(res, 404, { success: false, error: "黑名单中不存在该令牌" });
  }

  tokenBlacklist.delete(jti);
  sendJson(res, 200, { success: true, data: { message: "令牌已从黑名单移除" } });
}

/** GET /api/admin/users — 列出所有用户（管理员） */
function handleAdminListUsers(req, res) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  if (!auth.payload.roles || !auth.payload.roles.includes("admin")) {
    return sendJson(res, 403, { success: false, error: "需要管理员权限" });
  }

  const users = readUsers().map((u) => {
    const { password: _, ...safe } = u;
    return safe;
  });

  sendJson(res, 200, { success: true, data: users });
}

/** PUT /api/admin/users/:id/roles — 修改用户角色 */
async function handleAdminUpdateRoles(req, res, userId) {
  const auth = requireAuth(req);
  if (!auth.authenticated) return sendJson(res, 401, { success: false, error: auth.error });

  if (!auth.payload.roles || !auth.payload.roles.includes("admin")) {
    return sendJson(res, 403, { success: false, error: "需要管理员权限" });
  }

  const body = await parseBody(req);
  if (!body.roles || !Array.isArray(body.roles)) {
    return sendJson(res, 400, { success: false, error: "roles 必须是数组" });
  }

  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return sendJson(res, 404, { success: false, error: "用户不存在" });

  user.roles = body.roles;
  user.updatedAt = new Date().toISOString();
  writeUsers(users);

  // 撤销该用户所有刷新令牌，强制重新登录
  revokeAllRefreshTokens(userId);

  const { password: _, ...safeUser } = user;
  sendJson(res, 200, { success: true, data: safeUser });
}

// ─── 请求路由 ──────────────────────────────────────────────

async function handleRequest(req, res) {
  // CORS 预检
  if (handleCors(req, res)) return;

  // 限流
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const rateResult = checkRateLimit(clientIp);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
  res.setHeader("X-RateLimit-Remaining", rateResult.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(rateResult.resetAt / 1000));

  if (!rateResult.allowed) {
    res.writeHead(429, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
    return res.end(JSON.stringify({ success: false, error: "请求过于频繁，请稍后再试" }));
  }

  const segments = parsePath(req.url);
  const method = req.method;

  // 添加 CORS 头到所有响应
  const originalWriteHead = res.writeHead;
  res.writeHead = function (statusCode, headers) {
    const mergedHeaders = { ...corsHeaders(), ...headers };
    return originalWriteHead.call(this, statusCode, mergedHeaders);
  };

  try {
    // /api/auth/* — 认证路由
    if (segments[0] === "api" && segments[1] === "auth") {
      const action = segments[2];

      if (method === "POST" && action === "register") return await handleRegister(req, res);
      if (method === "POST" && action === "login") return await handleLogin(req, res);
      if (method === "POST" && action === "refresh") return await handleRefresh(req, res);
      if (method === "POST" && action === "logout") return await handleLogout(req, res);
      if (method === "GET" && action === "profile") return handleGetProfile(req, res);
      if (method === "PUT" && action === "profile") return await handleUpdateProfile(req, res);
      if (method === "POST" && action === "change-password") return await handleChangePassword(req, res);
    }

    // /api/jwt/* — JWT 工具路由
    if (segments[0] === "api" && segments[1] === "jwt") {
      const action = segments[2];

      if (method === "POST" && action === "generate") return await handleJwtGenerate(req, res);
      if (method === "POST" && action === "verify") return await handleJwtVerify(req, res);
      if (method === "POST" && action === "decode") return await handleJwtDecode(req, res);
      if (method === "POST" && action === "revoke") return await handleJwtRevoke(req, res);
      if (method === "POST" && action === "introspect") return await handleJwtIntrospect(req, res);
    }

    // /api/keys/* — API Key 路由
    if (segments[0] === "api" && segments[1] === "keys") {
      if (method === "GET") return handleListApiKeys(req, res);
      if (method === "POST") return await handleCreateApiKey(req, res);
      if (method === "DELETE" && segments[2]) return handleRevokeApiKey(req, res, segments[2]);
    }

    // /api/clients/* — 客户端管理路由
    if (segments[0] === "api" && segments[1] === "clients") {
      if (method === "GET") return handleListClients(req, res);
      if (method === "POST") return await handleCreateClient(req, res);
      if (method === "DELETE" && segments[2]) return handleDeleteClient(req, res, segments[2]);
    }

    // /api/admin/* — 管理路由
    if (segments[0] === "api" && segments[1] === "admin") {
      const action = segments[2];

      if (method === "GET" && action === "stats") return handleAdminStats(req, res);
      if (method === "GET" && action === "blacklist") return handleAdminBlacklist(req, res);
      if (method === "DELETE" && action === "blacklist" && segments[3]) return handleAdminUnblacklist(req, res, segments[3]);
      if (method === "GET" && action === "users") return handleAdminListUsers(req, res);
      if (method === "PUT" && action === "users" && segments[3] && segments[4] === "roles") {
        return await handleAdminUpdateRoles(req, res, segments[3]);
      }
    }

    // /health — 健康检查
    if (segments[0] === "health" && segments.length === 1) {
      return sendJson(res, 200, { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
    }

    // 404
    sendJson(res, 404, { success: false, error: "接口未找到" });
  } catch (err) {
    console.error("服务器错误:", err.message);
    sendJson(res, 500, { success: false, error: "服务器内部错误" });
  }
}

// ─── 初始化并启动 ──────────────────────────────────────────────

// 初始化默认客户端
initDefaultClient();

// 创建默认管理员（如果不存在）
function initAdminUser() {
  const users = readUsers();
  if (!users.find((u) => u.roles && u.roles.includes("admin"))) {
    const salt = generateSalt();
    const hashedPwd = hashPassword("admin123", salt);
    const now = new Date().toISOString();
    users.push({
      id: generateId(),
      username: "admin",
      email: "admin@jwt-auth.local",
      password: `${salt}:${hashedPwd}`,
      nickname: "管理员",
      roles: ["admin", "user"],
      avatar: null,
      createdAt: now,
      updatedAt: now,
    });
    writeUsers(users);
    console.log("   已创建默认管理员: admin / admin123");
  }
}
initAdminUser();

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log("  JWT 认证服务器已启动");
  console.log(`  地址: http://localhost:${PORT}`);
  console.log("  ─────────────────────────────────────────────");
  console.log("  认证接口:");
  console.log("    POST   /api/auth/register         用户注册");
  console.log("    POST   /api/auth/login             用户登录");
  console.log("    POST   /api/auth/refresh           刷新令牌");
  console.log("    POST   /api/auth/logout            用户登出");
  console.log("    GET    /api/auth/profile           获取用户信息");
  console.log("    PUT    /api/auth/profile           更新用户信息");
  console.log("    POST   /api/auth/change-password   修改密码");
  console.log("  ─────────────────────────────────────────────");
  console.log("  JWT 工具接口:");
  console.log("    POST   /api/jwt/generate           自定义生成 JWT");
  console.log("    POST   /api/jwt/verify             验证 JWT");
  console.log("    POST   /api/jwt/decode             解码 JWT (不验证)");
  console.log("    POST   /api/jwt/revoke             撤销 JWT");
  console.log("    POST   /api/jwt/introspect         令牌内省 (RFC 7662)");
  console.log("  ─────────────────────────────────────────────");
  console.log("  API Key 接口:");
  console.log("    GET    /api/keys                   列出 API Keys");
  console.log("    POST   /api/keys                   创建 API Key");
  console.log("    DELETE /api/keys/:id               撤销 API Key");
  console.log("  ─────────────────────────────────────────────");
  console.log("  客户端管理:");
  console.log("    GET    /api/clients                列出客户端");
  console.log("    POST   /api/clients                创建客户端");
  console.log("    DELETE /api/clients/:id            删除客户端");
  console.log("  ─────────────────────────────────────────────");
  console.log("  管理接口 (需 admin 角色):");
  console.log("    GET    /api/admin/stats            系统统计");
  console.log("    GET    /api/admin/blacklist        查看黑名单");
  console.log("    DELETE /api/admin/blacklist/:jti   移除黑名单");
  console.log("    GET    /api/admin/users            列出所有用户");
  console.log("    PUT    /api/admin/users/:id/roles  修改用户角色");
  console.log("  ─────────────────────────────────────────────");
  console.log("  其他:");
  console.log("    GET    /health                     健康检查");
  console.log("  ─────────────────────────────────────────────");
  console.log("  支持的 JWT 算法: HS256, HS384, HS512, RS256, RS384, RS512");
  console.log("  限流: 每分钟最多 60 次请求");
});
