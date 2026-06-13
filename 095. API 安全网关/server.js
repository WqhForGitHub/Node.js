// API 安全网关 - 纯 Node.js 实现
// 特性: 路由转发、JWT 鉴权、API Key、IP 黑白名单、签名校验、SQL/XSS 注入检测、请求日志
const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

// ========= 配置 =========
const config = {
  routes: [
    { prefix: '/api/public', target: 'http://localhost:3094', auth: 'none' },
    { prefix: '/api/users',  target: 'http://localhost:3089', auth: 'apikey' },
    { prefix: '/api/admin',  target: 'http://localhost:3090', auth: 'jwt', roles: ['admin'] },
    { prefix: '/api/secure', target: 'http://localhost:3091', auth: 'sign' }
  ],
  apiKeys: {
    'demo-key-123': { user: 'alice', plan: 'free' },
    'admin-key-xyz': { user: 'admin', plan: 'pro' }
  },
  jwtSecret: 'gateway-secret-key',
  signSecret: 'shared-sign-secret',
  ipWhitelist: [],          // 空表示不限制
  ipBlacklist: ['1.2.3.4'],
  // 注入检测正则
  injectionPatterns: [
    /(union\s+select)|(\bor\s+1=1)|(\bdrop\s+table)/i,   // SQL
    /<script[^>]*>|javascript:|onerror\s*=/i              // XSS
  ]
};

// ========= JWT(HS256) 实现 =========
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }

function jwtSign(payload, secret) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
function jwtVerify(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    const expect = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
    if (expect !== s) return null;
    const payload = JSON.parse(b64urlDecode(p).toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ========= 请求日志 =========
const logs = [];
function logRequest(entry) {
  logs.unshift(entry);
  if (logs.length > 500) logs.pop();
}

// ========= 安全检测 =========
function detectInjection(text) {
  if (!text) return null;
  for (const re of config.injectionPatterns) {
    if (re.test(text)) return re.toString();
  }
  return null;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress;
}

// ========= 鉴权 =========
function authenticate(route, req) {
  if (route.auth === 'none') return { ok: true };
  if (route.auth === 'apikey') {
    const key = req.headers['x-api-key'];
    const info = config.apiKeys[key];
    if (!info) return { ok: false, code: 401, error: 'invalid api key' };
    return { ok: true, user: info };
  }
  if (route.auth === 'jwt') {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = jwtVerify(token, config.jwtSecret);
    if (!payload) return { ok: false, code: 401, error: 'invalid jwt' };
    if (route.roles && !(route.roles.includes(payload.role))) {
      return { ok: false, code: 403, error: 'forbidden role' };
    }
    return { ok: true, user: payload };
  }
  if (route.auth === 'sign') {
    // X-Timestamp + X-Sign = HMAC(secret, ts + path + body)
    const ts = req.headers['x-timestamp'];
    const sign = req.headers['x-sign'];
    if (!ts || !sign) return { ok: false, code: 401, error: 'missing sign' };
    if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return { ok: false, code: 401, error: 'timestamp expired' };
    return { ok: true, _verifyLater: { ts, sign } };
  }
  return { ok: false, code: 401, error: 'unknown auth' };
}

// ========= 转发 =========
function proxy(req, res, route, body) {
  const targetUrl = url.parse(route.target);
  const newPath = req.url.substring(route.prefix.length) || '/';
  const opts = {
    method: req.method,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: newPath,
    headers: { ...req.headers, host: targetUrl.host }
  };
  const proxyReq = http.request(opts, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', e => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway', detail: e.message }));
  });
  if (body) proxyReq.write(body);
  proxyReq.end();
}

// ========= 主请求处理 =========
const server = http.createServer((req, res) => {
  const ip = getClientIp(req);
  const startTime = Date.now();
  const reqId = crypto.randomBytes(4).toString('hex');

  // 网关自身路由
  if (req.url === '/__gateway/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  }
  if (req.url === '/__gateway/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(logs.slice(0, 50), null, 2));
  }
  if (req.url === '/__gateway/token' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    return req.on('end', () => {
      try {
        const { user = 'anon', role = 'user' } = JSON.parse(body || '{}');
        const token = jwtSign({ user, role, exp: Math.floor(Date.now() / 1000) + 3600 }, config.jwtSecret);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token }));
      } catch (e) {
        res.writeHead(400); res.end('bad json');
      }
    });
  }
  if (req.url === '/__gateway/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      routes: config.routes,
      apiKeys: Object.keys(config.apiKeys),
      ipBlacklist: config.ipBlacklist
    }, null, 2));
  }
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      name: 'API 安全网关',
      port: 3095,
      endpoints: [
        'GET  /__gateway/health',
        'GET  /__gateway/logs',
        'GET  /__gateway/config',
        'POST /__gateway/token  {user, role}    生成测试 JWT',
        '路由: ' + config.routes.map(r => `${r.prefix} -> ${r.target} [${r.auth}]`).join(', ')
      ]
    }, null, 2));
  }

  // IP 检查
  if (config.ipBlacklist.includes(ip)) {
    res.writeHead(403); res.end('IP banned');
    return logRequest({ reqId, ip, status: 403, reason: 'ip-ban', path: req.url });
  }
  if (config.ipWhitelist.length > 0 && !config.ipWhitelist.includes(ip)) {
    res.writeHead(403); res.end('IP not allowed');
    return logRequest({ reqId, ip, status: 403, reason: 'ip-not-allowed', path: req.url });
  }

  // 匹配路由
  const route = config.routes.find(r => req.url.startsWith(r.prefix));
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route Not Found' }));
    return logRequest({ reqId, ip, status: 404, path: req.url });
  }

  // 注入检测(URL + body)
  const urlInj = detectInjection(decodeURIComponent(req.url));
  if (urlInj) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Injection detected', pattern: urlInj }));
    return logRequest({ reqId, ip, status: 400, reason: 'injection-url', path: req.url });
  }

  // 收集 body 后再处理鉴权与签名
  let bodyChunks = [];
  req.on('data', c => bodyChunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks).toString();
    const bodyInj = detectInjection(body);
    if (bodyInj) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Injection detected in body', pattern: bodyInj }));
      return logRequest({ reqId, ip, status: 400, reason: 'injection-body', path: req.url });
    }

    const auth = authenticate(route, req);
    if (!auth.ok) {
      res.writeHead(auth.code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: auth.error }));
      return logRequest({ reqId, ip, status: auth.code, reason: auth.error, path: req.url });
    }
    // 签名延迟校验
    if (auth._verifyLater) {
      const { ts, sign } = auth._verifyLater;
      const expect = crypto.createHmac('sha256', config.signSecret)
        .update(ts + req.url + body).digest('hex');
      if (expect !== sign) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid sign' }));
        return logRequest({ reqId, ip, status: 401, reason: 'invalid-sign', path: req.url });
      }
    }

    proxy(req, res, route, body);
    logRequest({
      reqId, ip, ts: Date.now(),
      method: req.method, path: req.url,
      route: route.prefix, target: route.target,
      duration: Date.now() - startTime,
      user: auth.user
    });
  });
});

const PORT = 3095;
server.listen(PORT, () => {
  console.log(`[API 安全网关] http://localhost:${PORT}`);
  console.log('生成测试 JWT: curl -X POST http://localhost:3095/__gateway/token -d \'{"user":"x","role":"admin"}\' -H "Content-Type: application/json"');
});
