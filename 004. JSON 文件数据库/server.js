const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 配置 ──────────────────────────────────────────────

const PORT = 3004;
const DATA_DIR = path.join(__dirname, 'data');
const META_FILE = path.join(DATA_DIR, '_meta.json');

// ─── 数据层 ──────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readMeta() {
  ensureDataDir();
  if (!fs.existsSync(META_FILE)) {
    fs.writeFileSync(META_FILE, JSON.stringify({ collections: {} }, null, 2), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
}

function writeMeta(meta) {
  ensureDataDir();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

function getCollectionFile(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readCollection(name) {
  const file = getCollectionFile(name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeCollection(name, data) {
  ensureDataDir();
  fs.writeFileSync(getCollectionFile(name), JSON.stringify(data, null, 2), 'utf-8');
}

// ─── 工具函数 ──────────────────────────────────────────────

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parsePath(url) {
  const pathname = url.split('?')[0];
  const segments = pathname.replace(/^\/|\/$/g, '').split('/');
  return { segments };
}

function parseQuery(url) {
  const queryStr = url.split('?')[1] || '';
  const query = {};
  if (!queryStr) return query;
  for (const pair of queryStr.split('&')) {
    const [key, ...vals] = pair.split('=');
    if (key) query[decodeURIComponent(key)] = decodeURIComponent(vals.join('='));
  }
  return query;
}

function isValidCollectionName(name) {
  return typeof name === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name !== '_meta';
}

function matchDocument(doc, filter) {
  for (const [key, value] of Object.entries(filter)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 操作符查询
      if (value.$eq !== undefined && doc[key] !== value.$eq) return false;
      if (value.$ne !== undefined && doc[key] === value.$ne) return false;
      if (value.$gt !== undefined && !(doc[key] > value.$gt)) return false;
      if (value.$gte !== undefined && !(doc[key] >= value.$gte)) return false;
      if (value.$lt !== undefined && !(doc[key] < value.$lt)) return false;
      if (value.$lte !== undefined && !(doc[key] <= value.$lte)) return false;
      if (value.$in !== undefined) {
        if (!Array.isArray(value.$in) || !value.$in.includes(doc[key])) return false;
      }
      if (value.$nin !== undefined) {
        if (!Array.isArray(value.$nin) || value.$nin.includes(doc[key])) return false;
      }
      if (value.$contains !== undefined) {
        if (typeof doc[key] !== 'string' || !doc[key].includes(value.$contains)) return false;
      }
      if (value.$startsWith !== undefined) {
        if (typeof doc[key] !== 'string' || !doc[key].startsWith(value.$startsWith)) return false;
      }
      if (value.$endsWith !== undefined) {
        if (typeof doc[key] !== 'string' || !doc[key].endsWith(value.$endsWith)) return false;
      }
    } else {
      // 精确匹配
      if (doc[key] !== value) return false;
    }
  }
  return true;
}

function sortDocuments(docs, sort) {
  // sort 格式: { field: 1 } 升序 / { field: -1 } 降序，支持多字段
  const sortFields = Object.entries(sort);
  if (sortFields.length === 0) return docs;

  return [...docs].sort((a, b) => {
    for (const [field, order] of sortFields) {
      const va = a[field];
      const vb = b[field];
      if (va === vb) continue;
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      const cmp = va < vb ? -1 : 1;
      return cmp * (order === -1 ? -1 : 1);
    }
    return 0;
  });
}

// ─── 集合处理器 ──────────────────────────────────────────────

// 列出所有集合
async function handleListCollections(req, res) {
  const meta = readMeta();
  const collections = Object.entries(meta.collections).map(([name, info]) => ({
    name,
    count: readCollection(name)?.length || 0,
    indexes: info.indexes || [],
    createdAt: info.createdAt,
  }));
  sendJson(res, 200, { success: true, data: collections });
}

// 创建集合
async function handleCreateCollection(req, res) {
  const body = await parseBody(req);
  const { name, indexes } = body;

  if (!name || !isValidCollectionName(name)) {
    return sendJson(res, 400, {
      success: false,
      error: '集合名称无效，仅允许字母、数字和下划线，且不能以数字开头',
    });
  }

  const meta = readMeta();
  if (meta.collections[name]) {
    return sendJson(res, 409, {
      success: false,
      error: `集合 '${name}' 已存在`,
    });
  }

  meta.collections[name] = {
    indexes: Array.isArray(indexes) ? indexes : [],
    createdAt: new Date().toISOString(),
  };
  writeMeta(meta);
  writeCollection(name, []);

  sendJson(res, 201, {
    success: true,
    data: {
      name,
      indexes: meta.collections[name].indexes,
      createdAt: meta.collections[name].createdAt,
    },
  });
}

// 删除集合
async function handleDeleteCollection(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  delete meta.collections[collectionName];
  writeMeta(meta);

  const file = getCollectionFile(collectionName);
  if (fs.existsSync(file)) fs.unlinkSync(file);

  sendJson(res, 200, {
    success: true,
    data: { message: `集合 '${collectionName}' 已删除` },
  });
}

// 获取集合统计信息
async function handleCollectionStats(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const docs = readCollection(collectionName) || [];
  const info = meta.collections[collectionName];

  // 计算字段统计
  const fieldStats = {};
  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (!fieldStats[key]) fieldStats[key] = { count: 0, types: new Set() };
      fieldStats[key].count++;
      fieldStats[key].types.add(typeof value);
    }
  }
  // Set -> Array 以便 JSON 序列化
  for (const stats of Object.values(fieldStats)) {
    stats.types = [...stats.types];
  }

  sendJson(res, 200, {
    success: true,
    data: {
      name: collectionName,
      count: docs.length,
      indexes: info.indexes,
      createdAt: info.createdAt,
      fields: fieldStats,
      fileSize: fs.existsSync(getCollectionFile(collectionName))
        ? fs.statSync(getCollectionFile(collectionName)).size
        : 0,
    },
  });
}

// ─── 文档处理器 ──────────────────────────────────────────────

// 列出文档（支持查询、排序、分页）
async function handleListDocs(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const query = parseQuery(req.url);
  let docs = readCollection(collectionName) || [];

  // 过滤：支持 query 参数中的 filter（JSON 格式）
  if (query.filter) {
    try {
      const filter = JSON.parse(query.filter);
      docs = docs.filter((doc) => matchDocument(doc, filter));
    } catch {
      return sendJson(res, 400, {
        success: false,
        error: 'filter 参数格式错误，需为有效 JSON',
      });
    }
  }

  // 字段选择
  let selectFields = null;
  if (query.fields) {
    selectFields = query.fields
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  }

  // 排序
  if (query.sort) {
    try {
      const sort = JSON.parse(query.sort);
      docs = sortDocuments(docs, sort);
    } catch {
      return sendJson(res, 400, {
        success: false,
        error: 'sort 参数格式错误，需为有效 JSON，如 {"title": 1}',
      });
    }
  }

  // 分页
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const total = docs.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const pagedDocs = docs.slice(offset, offset + limit);

  // 字段投影
  const projected = selectFields
    ? pagedDocs.map((doc) => {
        const result = { id: doc.id };
        for (const f of selectFields) {
          if (f !== 'id' && doc[f] !== undefined) result[f] = doc[f];
        }
        return result;
      })
    : pagedDocs;

  sendJson(res, 200, {
    success: true,
    data: projected,
    pagination: { page, limit, total, totalPages },
  });
}

// 创建文档
async function handleCreateDoc(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, {
      success: false,
      error: '请求体必须是一个 JSON 对象',
    });
  }

  const docs = readCollection(collectionName) || [];
  const now = new Date().toISOString();

  // 唯一索引校验
  const indexes = meta.collections[collectionName].indexes || [];
  for (const idx of indexes) {
    if (body[idx] !== undefined) {
      const duplicate = docs.find((d) => d[idx] === body[idx]);
      if (duplicate) {
        return sendJson(res, 409, {
          success: false,
          error: `索引字段 '${idx}' 的值已存在: ${body[idx]}`,
        });
      }
    }
  }

  const doc = {
    id: generateId(),
    ...body,
    createdAt: now,
    updatedAt: now,
  };

  docs.push(doc);
  writeCollection(collectionName, docs);

  sendJson(res, 201, { success: true, data: doc });
}

// 批量创建文档
async function handleBulkCreateDocs(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  if (!Array.isArray(body)) {
    return sendJson(res, 400, {
      success: false,
      error: '请求体必须是一个 JSON 数组',
    });
  }

  const docs = readCollection(collectionName) || [];
  const now = new Date().toISOString();
  const indexes = meta.collections[collectionName].indexes || [];
  const created = [];

  for (const item of body) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    // 唯一索引校验
    let skip = false;
    for (const idx of indexes) {
      if (item[idx] !== undefined) {
        const duplicate = docs.find((d) => d[idx] === item[idx]);
        if (duplicate) {
          skip = true;
          break;
        }
      }
    }
    if (skip) continue;

    const doc = { id: generateId(), ...item, createdAt: now, updatedAt: now };
    docs.push(doc);
    created.push(doc);
  }

  writeCollection(collectionName, docs);

  sendJson(res, 201, { success: true, data: created, count: created.length });
}

// 获取单个文档
async function handleGetDoc(req, res, collectionName, docId) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const docs = readCollection(collectionName) || [];
  const doc = docs.find((d) => d.id === docId);

  if (!doc) {
    return sendJson(res, 404, {
      success: false,
      error: `文档未找到 (id: ${docId})`,
    });
  }

  sendJson(res, 200, { success: true, data: doc });
}

// 更新文档
async function handleUpdateDoc(req, res, collectionName, docId) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, {
      success: false,
      error: '请求体必须是一个 JSON 对象',
    });
  }

  const docs = readCollection(collectionName) || [];
  const index = docs.findIndex((d) => d.id === docId);

  if (index === -1) {
    return sendJson(res, 404, {
      success: false,
      error: `文档未找到 (id: ${docId})`,
    });
  }

  // 唯一索引校验
  const indexes = meta.collections[collectionName].indexes || [];
  for (const idx of indexes) {
    if (body[idx] !== undefined) {
      const duplicate = docs.find((d) => d.id !== docId && d[idx] === body[idx]);
      if (duplicate) {
        return sendJson(res, 409, {
          success: false,
          error: `索引字段 '${idx}' 的值已存在: ${body[idx]}`,
        });
      }
    }
  }

  // 不允许修改 id、createdAt
  const { id, createdAt, ...updates } = body;
  docs[index] = {
    ...docs[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeCollection(collectionName, docs);

  sendJson(res, 200, { success: true, data: docs[index] });
}

// 删除文档
async function handleDeleteDoc(req, res, collectionName, docId) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const docs = readCollection(collectionName) || [];
  const index = docs.findIndex((d) => d.id === docId);

  if (index === -1) {
    return sendJson(res, 404, {
      success: false,
      error: `文档未找到 (id: ${docId})`,
    });
  }

  const deleted = docs.splice(index, 1)[0];
  writeCollection(collectionName, docs);

  sendJson(res, 200, { success: true, data: deleted });
}

// 高级查询
async function handleQueryDocs(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  const { filter, sort, projection, page, limit } = body;

  let docs = readCollection(collectionName) || [];

  // 过滤
  if (filter && typeof filter === 'object') {
    docs = docs.filter((doc) => matchDocument(doc, filter));
  }

  // 排序
  if (sort && typeof sort === 'object') {
    docs = sortDocuments(docs, sort);
  }

  // 分页
  const p = Math.max(1, page || 1);
  const l = Math.min(100, Math.max(1, limit || 20));
  const total = docs.length;
  const totalPages = Math.ceil(total / l);
  const offset = (p - 1) * l;
  let result = docs.slice(offset, offset + l);

  // 字段投影
  if (projection && typeof projection === 'object') {
    const includeMode = !Object.values(projection).includes(0);
    result = result.map((doc) => {
      const projected = {};
      if (includeMode) {
        // 包含模式：只返回指定的字段（id 始终返回）
        projected.id = doc.id;
        for (const [key, val] of Object.entries(projection)) {
          if (val && key !== 'id' && doc[key] !== undefined) projected[key] = doc[key];
        }
      } else {
        // 排除模式：返回除了指定字段外的所有字段
        for (const [key, val] of Object.entries(doc)) {
          if (projection[key] !== 0) projected[key] = val;
        }
      }
      return projected;
    });
  }

  sendJson(res, 200, {
    success: true,
    data: result,
    pagination: { page: p, limit: l, total, totalPages },
  });
}

// 添加索引
async function handleAddIndex(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  const { field } = body;

  if (!field || typeof field !== 'string') {
    return sendJson(res, 400, {
      success: false,
      error: '必须指定索引字段名 (field)',
    });
  }

  const indexes = meta.collections[collectionName].indexes || [];
  if (indexes.includes(field)) {
    return sendJson(res, 409, {
      success: false,
      error: `索引 '${field}' 已存在`,
    });
  }

  // 检查现有数据是否有重复值
  const docs = readCollection(collectionName) || [];
  const values = docs.map((d) => d[field]).filter((v) => v !== undefined);
  const uniqueValues = new Set(values);
  if (values.length !== uniqueValues.size) {
    return sendJson(res, 400, {
      success: false,
      error: `字段 '${field}' 存在重复值，无法创建唯一索引`,
    });
  }

  indexes.push(field);
  meta.collections[collectionName].indexes = indexes;
  writeMeta(meta);

  sendJson(res, 200, { success: true, data: { indexes } });
}

// 删除索引
async function handleRemoveIndex(req, res, collectionName) {
  const meta = readMeta();
  if (!meta.collections[collectionName]) {
    return sendJson(res, 404, {
      success: false,
      error: `集合 '${collectionName}' 不存在`,
    });
  }

  const body = await parseBody(req);
  const { field } = body;

  if (!field || typeof field !== 'string') {
    return sendJson(res, 400, {
      success: false,
      error: '必须指定索引字段名 (field)',
    });
  }

  const indexes = meta.collections[collectionName].indexes || [];
  const idx = indexes.indexOf(field);
  if (idx === -1) {
    return sendJson(res, 404, {
      success: false,
      error: `索引 '${field}' 不存在`,
    });
  }

  indexes.splice(idx, 1);
  meta.collections[collectionName].indexes = indexes;
  writeMeta(meta);

  sendJson(res, 200, { success: true, data: { indexes } });
}

// ─── 请求路由 ──────────────────────────────────────────────

async function handler(req, res) {
  const method = req.method;
  const { segments } = parsePath(req.url);

  try {
    // GET /api/collections - 列出所有集合
    if (
      method === 'GET' &&
      segments.length === 2 &&
      segments[0] === 'api' &&
      segments[1] === 'collections'
    ) {
      return await handleListCollections(req, res);
    }

    // POST /api/collections - 创建集合
    if (
      method === 'POST' &&
      segments.length === 2 &&
      segments[0] === 'api' &&
      segments[1] === 'collections'
    ) {
      return await handleCreateCollection(req, res);
    }

    // 以下路由需要集合名称: /api/collections/:name/...
    if (segments.length >= 3 && segments[0] === 'api' && segments[1] === 'collections') {
      const collectionName = segments[2];

      // DELETE /api/collections/:name - 删除集合
      if (method === 'DELETE' && segments.length === 3) {
        return await handleDeleteCollection(req, res, collectionName);
      }

      // GET /api/collections/:name/stats - 集合统计
      if (method === 'GET' && segments.length === 4 && segments[3] === 'stats') {
        return await handleCollectionStats(req, res, collectionName);
      }

      // POST /api/collections/:name/indexes - 添加索引
      if (method === 'POST' && segments.length === 4 && segments[3] === 'indexes') {
        return await handleAddIndex(req, res, collectionName);
      }

      // DELETE /api/collections/:name/indexes - 删除索引
      if (method === 'DELETE' && segments.length === 4 && segments[3] === 'indexes') {
        return await handleRemoveIndex(req, res, collectionName);
      }

      // /api/collections/:name/docs/...
      if (segments.length >= 4 && segments[3] === 'docs') {
        // GET /api/collections/:name/docs - 列出文档
        if (method === 'GET' && segments.length === 4) {
          return await handleListDocs(req, res, collectionName);
        }

        // POST /api/collections/:name/docs - 创建文档
        if (method === 'POST' && segments.length === 4) {
          return await handleCreateDoc(req, res, collectionName);
        }

        // POST /api/collections/:name/docs/bulk - 批量创建
        if (method === 'POST' && segments.length === 5 && segments[4] === 'bulk') {
          return await handleBulkCreateDocs(req, res, collectionName);
        }

        // POST /api/collections/:name/docs/query - 高级查询
        if (method === 'POST' && segments.length === 5 && segments[4] === 'query') {
          return await handleQueryDocs(req, res, collectionName);
        }

        // /api/collections/:name/docs/:id
        if (segments.length === 5) {
          const docId = segments[4];

          // GET /api/collections/:name/docs/:id - 获取文档
          if (method === 'GET') {
            return await handleGetDoc(req, res, collectionName, docId);
          }

          // PUT /api/collections/:name/docs/:id - 更新文档
          if (method === 'PUT') {
            return await handleUpdateDoc(req, res, collectionName, docId);
          }

          // DELETE /api/collections/:name/docs/:id - 删除文档
          if (method === 'DELETE') {
            return await handleDeleteDoc(req, res, collectionName, docId);
          }
        }
      }
    }

    sendJson(res, 404, { success: false, error: '接口未找到' });
  } catch (err) {
    console.error('服务器错误:', err.message);
    sendJson(res, 500, { success: false, error: '服务器内部错误' });
  }
}

// ─── 启动服务器 ──────────────────────────────────────────────

const server = http.createServer(handler);
server.listen(PORT, () => {
  console.log('JSON 文件数据库已启动');
  console.log(`   地址: http://localhost:${PORT}`);
  console.log('   接口:');
  console.log('     GET    /api/collections                       - 列出所有集合');
  console.log('     POST   /api/collections                       - 创建集合');
  console.log('     DELETE /api/collections/:name                 - 删除集合');
  console.log('     GET    /api/collections/:name/stats            - 集合统计');
  console.log('     POST   /api/collections/:name/indexes          - 添加唯一索引');
  console.log('     DELETE /api/collections/:name/indexes          - 删除索引');
  console.log(
    '     GET    /api/collections/:name/docs             - 列出文档 (支持 filter/sort/page/limit/fields)'
  );
  console.log('     POST   /api/collections/:name/docs             - 创建文档');
  console.log('     POST   /api/collections/:name/docs/bulk       - 批量创建文档');
  console.log('     POST   /api/collections/:name/docs/query      - 高级查询 (POST body)');
  console.log('     GET    /api/collections/:name/docs/:id         - 获取文档');
  console.log('     PUT    /api/collections/:name/docs/:id         - 更新文档');
  console.log('     DELETE /api/collections/:name/docs/:id         - 删除文档');
});
