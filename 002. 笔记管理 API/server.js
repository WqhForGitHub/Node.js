const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 配置 ──────────────────────────────────────────────
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'notes.json');

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

/** 读取所有笔记 */
function readNotes() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

/** 写入所有笔记 */
function writeNotes(notes) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

/** 生成唯一 ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── 工具函数 ──────────────────────────────────────────────

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

/** 从 URL 中提取路由参数（如 /api/notes/abc123 → id=abc123） */
function parsePath(url) {
  const pathname = url.split('?')[0];
  const segments = pathname.replace(/^\/|\/$/g, '').split('/');
  return {
    segments,
    // /api/notes/:id  → id 在第 2 段（0-indexed）
    id: segments[0] === 'api' && segments[1] === 'notes' && segments[2] ? segments[2] : null,
  };
}

/** 解析查询字符串为对象 */
function parseQuery(url) {
  const qs = url.split('?')[1];
  if (!qs) return {};
  return Object.fromEntries(
    qs.split('&').map((pair) => {
      const [key, val] = pair.split('=');
      return [key, decodeURIComponent(val || '')];
    })
  );
}

// ─── 路由处理器 ──────────────────────────────────────────────

/** GET /api/notes — 获取所有笔记（支持搜索与分页） */
function handleGetNotes(req, res) {
  const query = parseQuery(req.url);
  let notes = readNotes();

  // 搜索：按标题或内容模糊匹配
  if (query.search) {
    const keyword = query.search.toLowerCase();
    notes = notes.filter(
      (n) => n.title.toLowerCase().includes(keyword) || n.content.toLowerCase().includes(keyword)
    );
  }

  // 分页
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const total = notes.length;
  const start = (page - 1) * limit;
  const items = notes.slice(start, start + limit);

  sendJson(res, 200, {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/** GET /api/notes/:id — 获取单条笔记 */
function handleGetNote(req, res, id) {
  const notes = readNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) {
    return sendJson(res, 404, { success: false, error: '笔记未找到' });
  }
  sendJson(res, 200, { success: true, data: note });
}

/** POST /api/notes — 创建笔记 */
async function handleCreateNote(req, res) {
  const body = await parseBody(req);

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return sendJson(res, 400, { success: false, error: 'title 为必填字段' });
  }

  const now = new Date().toISOString();
  const note = {
    id: generateId(),
    title: body.title.trim(),
    content: (body.content || '').trim(),
    tags: Array.isArray(body.tags) ? body.tags : [],
    createdAt: now,
    updatedAt: now,
  };

  const notes = readNotes();
  notes.unshift(note); // 最新的排在前面
  writeNotes(notes);

  sendJson(res, 201, { success: true, data: note });
}

/** PUT /api/notes/:id — 更新笔记 */
async function handleUpdateNote(req, res, id) {
  const notes = readNotes();
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) {
    return sendJson(res, 404, { success: false, error: '笔记未找到' });
  }

  const body = await parseBody(req);
  const note = notes[index];

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return sendJson(res, 400, { success: false, error: 'title 不能为空' });
    }
    note.title = body.title.trim();
  }
  if (body.content !== undefined) {
    note.content = body.content.trim();
  }
  if (body.tags !== undefined) {
    note.tags = Array.isArray(body.tags) ? body.tags : [];
  }
  note.updatedAt = new Date().toISOString();

  notes[index] = note;
  writeNotes(notes);

  sendJson(res, 200, { success: true, data: note });
}

/** DELETE /api/notes/:id — 删除笔记 */
function handleDeleteNote(req, res, id) {
  const notes = readNotes();
  const index = notes.findIndex((n) => n.id === id);
  if (index === -1) {
    return sendJson(res, 404, { success: false, error: '笔记未找到' });
  }

  const deleted = notes.splice(index, 1)[0];
  writeNotes(notes);

  sendJson(res, 200, { success: true, data: deleted });
}

// ─── 请求路由 ──────────────────────────────────────────────

async function handleRequest(req, res) {
  const { segments, id } = parsePath(req.url);
  const method = req.method;

  // 路由匹配：/api/notes[/id]
  if (segments[0] === 'api' && segments[1] === 'notes') {
    try {
      // GET /api/notes
      if (method === 'GET' && !id) {
        return handleGetNotes(req, res);
      }
      // GET /api/notes/:id
      if (method === 'GET' && id) {
        return handleGetNote(req, res, id);
      }
      // POST /api/notes
      if (method === 'POST' && !id) {
        return await handleCreateNote(req, res);
      }
      // PUT /api/notes/:id
      if (method === 'PUT' && id) {
        return await handleUpdateNote(req, res, id);
      }
      // DELETE /api/notes/:id
      if (method === 'DELETE' && id) {
        return handleDeleteNote(req, res, id);
      }

      // 方法不允许
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, error: '方法不允许' }));
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
  console.log(`📝 笔记管理 API 已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   接口:`);
  console.log(`     GET    /api/notes          获取所有笔记（支持 ?search= &page= &limit=）`);
  console.log(`     GET    /api/notes/:id      获取单条笔记`);
  console.log(`     POST   /api/notes          创建笔记`);
  console.log(`     PUT    /api/notes/:id      更新笔记`);
  console.log(`     DELETE /api/notes/:id      删除笔记`);
});
