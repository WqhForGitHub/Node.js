/**
 * URL 短链服务 - 纯 Node.js 实现
 *
 * 功能：
 *   POST /shorten          - 创建短链
 *   GET  /:code            - 302 重定向到原始 URL
 *   GET  /info/:code       - 查看短链信息（JSON）
 *   GET  /list             - 列出所有短链
 *   DELETE /:code          - 删除短链
 *   GET  /                 - API 说明页
 */

const http = require('http');
const url = require('url');
const store = require('./store');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ============== 工具函数 ==============

/**
 * 解析请求体为 JSON
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('请求体不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 发送 JSON 响应
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

/**
 * 发送 HTML 响应
 */
function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * 校验 URL 格式
 */
function isValidUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============== 路由处理 ==============

/** 首页 - API 说明 */
function handleIndex(req, res) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>URL 短链服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; background: #f5f5f5; color: #333; padding: 40px 20px; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { font-size: 1.8em; margin-bottom: 10px; }
    p.sub { color: #666; margin-bottom: 30px; }
    .card { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .card h2 { font-size: 1.1em; margin-bottom: 12px; color: #2563eb; }
    .card pre { background: #1e293b; color: #e2e8f0; padding: 14px 18px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.6; }
    .card p { margin-top: 8px; color: #555; font-size: 14px; }
    .method { color: #22c55e; font-weight: bold; }
    .method-post { color: #eab308; }
    .method-delete { color: #ef4444; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>URL 短链服务</h1>
    <p class="sub">纯 Node.js 实现，数据存储为本地 JSON 文件</p>

    <div class="card">
      <h2>创建短链</h2>
      <pre><span class="method method-post">POST</span> /shorten
Content-Type: application/json

{ "url": "https://example.com/very/long/url" }</pre>
      <p>返回：<code>{ "shortUrl": "http://localhost:3000/1", "code": "1", "originalUrl": "..." }</code></p>
    </div>

    <div class="card">
      <h2>访问短链（重定向）</h2>
      <pre><span class="method">GET</span> /:code</pre>
      <p>自动 302 重定向到原始 URL，同时增加访问计数。</p>
    </div>

    <div class="card">
      <h2>查看短链信息</h2>
      <pre><span class="method">GET</span> /info/:code</pre>
      <p>返回：<code>{ "code", "originalUrl", "visits", "createdAt" }</code></p>
    </div>

    <div class="card">
      <h2>列出所有短链</h2>
      <pre><span class="method">GET</span> /list</pre>
    </div>

    <div class="card">
      <h2>删除短链</h2>
      <pre><span class="method method-delete">DELETE</span> /:code</pre>
    </div>
  </div>
</body>
</html>`;
  sendHtml(res, 200, html);
}

/** POST /shorten - 创建短链 */
async function handleShorten(req, res) {
  try {
    const body = await parseBody(req);
    const originalUrl = body.url;

    if (!originalUrl) {
      return sendJson(res, 400, { error: '缺少 url 字段' });
    }
    if (!isValidUrl(originalUrl)) {
      return sendJson(res, 400, { error: 'url 格式不合法，仅支持 http/https' });
    }

    const result = store.createShortUrl(originalUrl);

    sendJson(res, result.isNew ? 201 : 200, {
      shortUrl: `${BASE_URL}/${result.code}`,
      code: result.code,
      originalUrl: result.originalUrl,
      createdAt: result.createdAt,
      isNew: result.isNew,
    });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

/** GET /:code - 302 重定向 */
function handleRedirect(req, res, code) {
  const result = store.getByCode(code);
  if (!result) {
    return sendJson(res, 404, { error: `短链 "${code}" 不存在` });
  }
  res.writeHead(302, { Location: result.originalUrl });
  res.end();
}

/** GET /info/:code - 查看短链信息 */
function handleInfo(req, res, code) {
  const info = store.getInfo(code);
  if (!info) {
    return sendJson(res, 404, { error: `短链 "${code}" 不存在` });
  }
  sendJson(res, 200, info);
}

/** GET /list - 列出所有短链 */
function handleList(req, res) {
  const list = store.listAll();
  sendJson(res, 200, { total: list.length, data: list });
}

/** DELETE /:code - 删除短链 */
function handleDelete(req, res, code) {
  const ok = store.deleteByCode(code);
  if (!ok) {
    return sendJson(res, 404, { error: `短链 "${code}" 不存在` });
  }
  sendJson(res, 200, { message: '删除成功', code });
}

// ============== 请求分发 ==============

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  // 路由匹配
  try {
    // GET / → 首页
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res);
    }

    // POST /shorten → 创建短链
    if (method === 'POST' && pathname === '/shorten') {
      return await handleShorten(req, res);
    }

    // GET /list → 列出所有
    if (method === 'GET' && pathname === '/list') {
      return handleList(req, res);
    }

    // GET /info/:code → 查看信息
    const infoMatch = pathname.match(/^\/info\/([0-9a-zA-Z]+)$/);
    if (method === 'GET' && infoMatch) {
      return handleInfo(req, res, infoMatch[1]);
    }

    // DELETE /:code → 删除
    const deleteMatch = pathname.match(/^\/([0-9a-zA-Z]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      return handleDelete(req, res, deleteMatch[1]);
    }

    // GET /:code → 重定向
    const redirectMatch = pathname.match(/^\/([0-9a-zA-Z]+)$/);
    if (method === 'GET' && redirectMatch) {
      return handleRedirect(req, res, redirectMatch[1]);
    }

    // 404
    sendJson(res, 404, { error: '接口不存在' });
  } catch (err) {
    console.error('服务器错误:', err);
    sendJson(res, 500, { error: '服务器内部错误' });
  }
});

// ============== 启动 ==============

server.listen(PORT, () => {
  console.log(`\n  URL 短链服务已启动`);
  console.log(`  地址: ${BASE_URL}`);
  console.log(`  数据: ${require('path').join(__dirname, 'data.json')}\n`);
});
