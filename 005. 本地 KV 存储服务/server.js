const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 配置 ──────────────────────────────────────────────

const PORT = 3005;
const DATA_DIR = path.join(__dirname, 'data');
const AOF_FILE = path.join(DATA_DIR, 'appendonly.aof');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json');
const SNAPSHOT_INTERVAL_MS = 60 * 1000; // 每 60 秒生成一次快照
const EXPIRE_SCAN_INTERVAL_MS = 1000; // 每 1 秒扫描一次过期键

// ─── 内存存储 ──────────────────────────────────────────────
// 数据结构: namespace -> Map<key, { value, type, expireAt }>
// type: "string" | "list" | "hash" | "set"

const store = new Map();

function getNamespace(ns) {
  if (!store.has(ns)) store.set(ns, new Map());
  return store.get(ns);
}

function getEntry(ns, key) {
  const space = store.get(ns);
  if (!space) return null;
  const entry = space.get(key);
  if (!entry) return null;
  if (entry.expireAt && entry.expireAt <= Date.now()) {
    space.delete(key);
    return null;
  }
  return entry;
}

function setEntry(ns, key, value, type, ttlMs) {
  const space = getNamespace(ns);
  const expireAt = ttlMs ? Date.now() + ttlMs : null;
  space.set(key, { value, type, expireAt });
}

function deleteEntry(ns, key) {
  const space = store.get(ns);
  if (!space) return false;
  return space.delete(key);
}

// ─── 持久化：AOF + 快照 ──────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let aofStream = null;
function getAofStream() {
  if (!aofStream) {
    ensureDataDir();
    aofStream = fs.createWriteStream(AOF_FILE, { flags: 'a' });
  }
  return aofStream;
}

function appendAof(op) {
  const line = JSON.stringify({ ...op, ts: Date.now() }) + '\n';
  getAofStream().write(line);
}

function takeSnapshot() {
  ensureDataDir();
  const data = {};
  for (const [ns, space] of store.entries()) {
    data[ns] = {};
    for (const [key, entry] of space.entries()) {
      if (entry.expireAt && entry.expireAt <= Date.now()) continue;
      data[ns][key] = entry;
    }
  }
  const tmp = SNAPSHOT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, SNAPSHOT_FILE);

  // 快照之后截断 AOF
  if (aofStream) {
    aofStream.end();
    aofStream = null;
  }
  if (fs.existsSync(AOF_FILE)) fs.unlinkSync(AOF_FILE);
}

function loadFromDisk() {
  ensureDataDir();

  // 1. 读取快照
  if (fs.existsSync(SNAPSHOT_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
      for (const [ns, space] of Object.entries(data)) {
        const map = getNamespace(ns);
        for (const [key, entry] of Object.entries(space)) {
          if (entry.expireAt && entry.expireAt <= Date.now()) continue;
          map.set(key, entry);
        }
      }
    } catch (err) {
      console.error('快照加载失败:', err.message);
    }
  }

  // 2. 重放 AOF
  if (fs.existsSync(AOF_FILE)) {
    const content = fs.readFileSync(AOF_FILE, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const op = JSON.parse(line);
        replayOp(op);
      } catch {
        // 忽略损坏的行
      }
    }
  }
}

function replayOp(op) {
  // 重放时不再写 AOF
  switch (op.cmd) {
    case 'SET':
      setEntry(op.ns, op.key, op.value, 'string', op.ttlMs);
      break;
    case 'DEL':
      deleteEntry(op.ns, op.key);
      break;
    case 'EXPIRE': {
      const entry = getEntry(op.ns, op.key);
      if (entry) entry.expireAt = op.expireAt;
      break;
    }
    case 'PERSIST': {
      const entry = getEntry(op.ns, op.key);
      if (entry) entry.expireAt = null;
      break;
    }
    case 'LPUSH':
    case 'RPUSH': {
      let entry = getEntry(op.ns, op.key);
      if (!entry) {
        setEntry(op.ns, op.key, [], 'list', null);
        entry = getEntry(op.ns, op.key);
      }
      if (entry.type !== 'list') break;
      if (op.cmd === 'LPUSH') entry.value.unshift(...op.values);
      else entry.value.push(...op.values);
      break;
    }
    case 'LPOP': {
      const entry = getEntry(op.ns, op.key);
      if (entry && entry.type === 'list') entry.value.shift();
      break;
    }
    case 'RPOP': {
      const entry = getEntry(op.ns, op.key);
      if (entry && entry.type === 'list') entry.value.pop();
      break;
    }
    case 'HSET': {
      let entry = getEntry(op.ns, op.key);
      if (!entry) {
        setEntry(op.ns, op.key, {}, 'hash', null);
        entry = getEntry(op.ns, op.key);
      }
      if (entry.type !== 'hash') break;
      Object.assign(entry.value, op.fields);
      break;
    }
    case 'HDEL': {
      const entry = getEntry(op.ns, op.key);
      if (entry && entry.type === 'hash') {
        for (const f of op.fields) delete entry.value[f];
      }
      break;
    }
    case 'SADD': {
      let entry = getEntry(op.ns, op.key);
      if (!entry) {
        setEntry(op.ns, op.key, [], 'set', null);
        entry = getEntry(op.ns, op.key);
      }
      if (entry.type !== 'set') break;
      for (const m of op.members) {
        if (!entry.value.includes(m)) entry.value.push(m);
      }
      break;
    }
    case 'SREM': {
      const entry = getEntry(op.ns, op.key);
      if (entry && entry.type === 'set') {
        entry.value = entry.value.filter((m) => !op.members.includes(m));
      }
      break;
    }
    case 'INCR':
    case 'DECR': {
      let entry = getEntry(op.ns, op.key);
      if (!entry) {
        setEntry(op.ns, op.key, 0, 'string', null);
        entry = getEntry(op.ns, op.key);
      }
      if (entry.type === 'string' && typeof entry.value === 'number') {
        entry.value += op.cmd === 'INCR' ? op.by || 1 : -(op.by || 1);
      }
      break;
    }
    case 'FLUSH':
      if (op.ns) store.delete(op.ns);
      else store.clear();
      break;
  }
}

// ─── 过期键扫描（被动 + 主动） ──────────────────────────────────────────────

function scanExpired() {
  const now = Date.now();
  for (const [ns, space] of store.entries()) {
    for (const [key, entry] of space.entries()) {
      if (entry.expireAt && entry.expireAt <= now) {
        space.delete(key);
      }
    }
  }
}

// ─── HTTP 工具 ──────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
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

function ok(res, data, extra = {}) {
  sendJson(res, 200, { success: true, data, ...extra });
}

function created(res, data) {
  sendJson(res, 201, { success: true, data });
}

function err(res, code, message) {
  sendJson(res, code, { success: false, error: message });
}

// ─── 处理器：字符串/通用 ──────────────────────────────────────────────

// GET /api/kv/:ns/:key
async function handleGet(req, res, ns, key) {
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  ok(res, {
    key,
    value: entry.value,
    type: entry.type,
    expireAt: entry.expireAt,
    ttl: entry.expireAt ? Math.max(0, entry.expireAt - Date.now()) : null,
  });
}

// PUT /api/kv/:ns/:key  body: { value, ttl? }
async function handleSet(req, res, ns, key) {
  const body = await parseBody(req);
  if (!('value' in body)) return err(res, 400, '请求体必须包含 value 字段');
  const ttlMs = typeof body.ttl === 'number' && body.ttl > 0 ? body.ttl : undefined;
  setEntry(ns, key, body.value, 'string', ttlMs);
  appendAof({ cmd: 'SET', ns, key, value: body.value, ttlMs });
  ok(res, { key, value: body.value, ttl: ttlMs || null });
}

// DELETE /api/kv/:ns/:key
async function handleDel(req, res, ns, key) {
  const existed = !!getEntry(ns, key);
  deleteEntry(ns, key);
  if (existed) appendAof({ cmd: 'DEL', ns, key });
  ok(res, { key, deleted: existed });
}

// GET /api/kv/:ns/:key/exists
async function handleExists(req, res, ns, key) {
  ok(res, { key, exists: !!getEntry(ns, key) });
}

// PUT /api/kv/:ns/:key/expire  body: { ttl }
async function handleExpire(req, res, ns, key) {
  const body = await parseBody(req);
  if (typeof body.ttl !== 'number' || body.ttl <= 0) return err(res, 400, 'ttl 必须是正数（毫秒）');
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  entry.expireAt = Date.now() + body.ttl;
  appendAof({ cmd: 'EXPIRE', ns, key, expireAt: entry.expireAt });
  ok(res, { key, expireAt: entry.expireAt, ttl: body.ttl });
}

// DELETE /api/kv/:ns/:key/expire（持久化此键）
async function handlePersist(req, res, ns, key) {
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  entry.expireAt = null;
  appendAof({ cmd: 'PERSIST', ns, key });
  ok(res, { key, persisted: true });
}

// GET /api/kv/:ns/:key/ttl
async function handleTtl(req, res, ns, key) {
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  ok(res, {
    key,
    ttl: entry.expireAt ? Math.max(0, entry.expireAt - Date.now()) : null,
    expireAt: entry.expireAt,
  });
}

// POST /api/kv/:ns/:key/incr   body: { by? }
async function handleIncr(req, res, ns, key, sign) {
  const body = await parseBody(req).catch(() => ({}));
  const by = typeof body.by === 'number' ? body.by : 1;
  let entry = getEntry(ns, key);
  if (!entry) {
    setEntry(ns, key, 0, 'string', null);
    entry = getEntry(ns, key);
  }
  if (entry.type !== 'string' || typeof entry.value !== 'number') {
    return err(res, 400, '键的值不是数字类型');
  }
  entry.value += sign === 1 ? by : -by;
  appendAof({ cmd: sign === 1 ? 'INCR' : 'DECR', ns, key, by });
  ok(res, { key, value: entry.value });
}

// ─── 处理器：列表 ──────────────────────────────────────────────

// POST /api/kv/:ns/:key/list/push  body: { values, direction? "left"|"right" }
async function handleListPush(req, res, ns, key) {
  const body = await parseBody(req);
  if (!Array.isArray(body.values) || body.values.length === 0)
    return err(res, 400, 'values 必须是非空数组');
  const dir = body.direction === 'left' ? 'left' : 'right';

  let entry = getEntry(ns, key);
  if (!entry) {
    setEntry(ns, key, [], 'list', null);
    entry = getEntry(ns, key);
  }
  if (entry.type !== 'list') return err(res, 400, '键的类型不是 list');

  if (dir === 'left') entry.value.unshift(...body.values);
  else entry.value.push(...body.values);

  appendAof({
    cmd: dir === 'left' ? 'LPUSH' : 'RPUSH',
    ns,
    key,
    values: body.values,
  });
  ok(res, { key, length: entry.value.length });
}

// POST /api/kv/:ns/:key/list/pop  body: { direction? "left"|"right" }
async function handleListPop(req, res, ns, key) {
  const body = await parseBody(req).catch(() => ({}));
  const dir = body.direction === 'right' ? 'right' : 'left';

  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'list') return err(res, 400, '键的类型不是 list');

  if (entry.value.length === 0) return ok(res, { key, value: null });
  const value = dir === 'left' ? entry.value.shift() : entry.value.pop();
  appendAof({ cmd: dir === 'left' ? 'LPOP' : 'RPOP', ns, key });
  ok(res, { key, value, length: entry.value.length });
}

// GET /api/kv/:ns/:key/list?start=0&end=-1
async function handleListRange(req, res, ns, key) {
  const q = parseQuery(req.url);
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'list') return err(res, 400, '键的类型不是 list');

  const len = entry.value.length;
  let start = parseInt(q.start);
  let end = parseInt(q.end);
  if (isNaN(start)) start = 0;
  if (isNaN(end)) end = -1;
  if (start < 0) start = Math.max(0, len + start);
  if (end < 0) end = len + end;
  end = Math.min(len - 1, end);

  const items = start > end ? [] : entry.value.slice(start, end + 1);
  ok(res, { key, items, length: len });
}

// ─── 处理器：哈希 ──────────────────────────────────────────────

// PUT /api/kv/:ns/:key/hash  body: { fields: { f1: v1, ... } }
async function handleHashSet(req, res, ns, key) {
  const body = await parseBody(req);
  if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields))
    return err(res, 400, 'fields 必须是一个对象');

  let entry = getEntry(ns, key);
  if (!entry) {
    setEntry(ns, key, {}, 'hash', null);
    entry = getEntry(ns, key);
  }
  if (entry.type !== 'hash') return err(res, 400, '键的类型不是 hash');

  Object.assign(entry.value, body.fields);
  appendAof({ cmd: 'HSET', ns, key, fields: body.fields });
  ok(res, { key, fields: Object.keys(body.fields) });
}

// GET /api/kv/:ns/:key/hash[?field=xxx]
async function handleHashGet(req, res, ns, key) {
  const q = parseQuery(req.url);
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'hash') return err(res, 400, '键的类型不是 hash');

  if (q.field) {
    if (!(q.field in entry.value)) return err(res, 404, `字段不存在: ${q.field}`);
    return ok(res, { key, field: q.field, value: entry.value[q.field] });
  }
  ok(res, { key, value: entry.value });
}

// DELETE /api/kv/:ns/:key/hash  body: { fields: [...] }
async function handleHashDel(req, res, ns, key) {
  const body = await parseBody(req);
  if (!Array.isArray(body.fields) || body.fields.length === 0)
    return err(res, 400, 'fields 必须是非空数组');

  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'hash') return err(res, 400, '键的类型不是 hash');

  let deleted = 0;
  for (const f of body.fields) {
    if (f in entry.value) {
      delete entry.value[f];
      deleted++;
    }
  }
  appendAof({ cmd: 'HDEL', ns, key, fields: body.fields });
  ok(res, { key, deleted });
}

// ─── 处理器：集合 ──────────────────────────────────────────────

// POST /api/kv/:ns/:key/set/add  body: { members: [...] }
async function handleSetAdd(req, res, ns, key) {
  const body = await parseBody(req);
  if (!Array.isArray(body.members) || body.members.length === 0)
    return err(res, 400, 'members 必须是非空数组');

  let entry = getEntry(ns, key);
  if (!entry) {
    setEntry(ns, key, [], 'set', null);
    entry = getEntry(ns, key);
  }
  if (entry.type !== 'set') return err(res, 400, '键的类型不是 set');

  let added = 0;
  for (const m of body.members) {
    if (!entry.value.includes(m)) {
      entry.value.push(m);
      added++;
    }
  }
  appendAof({ cmd: 'SADD', ns, key, members: body.members });
  ok(res, { key, added, size: entry.value.length });
}

// POST /api/kv/:ns/:key/set/remove  body: { members: [...] }
async function handleSetRemove(req, res, ns, key) {
  const body = await parseBody(req);
  if (!Array.isArray(body.members) || body.members.length === 0)
    return err(res, 400, 'members 必须是非空数组');

  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'set') return err(res, 400, '键的类型不是 set');

  const before = entry.value.length;
  entry.value = entry.value.filter((m) => !body.members.includes(m));
  appendAof({ cmd: 'SREM', ns, key, members: body.members });
  ok(res, {
    key,
    removed: before - entry.value.length,
    size: entry.value.length,
  });
}

// GET /api/kv/:ns/:key/set
async function handleSetMembers(req, res, ns, key) {
  const entry = getEntry(ns, key);
  if (!entry) return err(res, 404, `键不存在: ${key}`);
  if (entry.type !== 'set') return err(res, 400, '键的类型不是 set');
  ok(res, { key, members: [...entry.value], size: entry.value.length });
}

// ─── 处理器：命名空间与管理 ──────────────────────────────────────────────

// GET /api/namespaces
async function handleListNamespaces(req, res) {
  const list = [];
  for (const [ns, space] of store.entries()) {
    let live = 0;
    const now = Date.now();
    for (const entry of space.values()) {
      if (!entry.expireAt || entry.expireAt > now) live++;
    }
    list.push({ namespace: ns, keys: live });
  }
  ok(res, list);
}

// GET /api/kv/:ns?pattern=foo*&limit=100
async function handleListKeys(req, res, ns) {
  const q = parseQuery(req.url);
  const space = store.get(ns);
  if (!space) return ok(res, [], { total: 0 });

  const limit = Math.min(1000, Math.max(1, parseInt(q.limit) || 100));
  const pattern = q.pattern || '*';
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$'
  );

  const now = Date.now();
  const keys = [];
  for (const [key, entry] of space.entries()) {
    if (entry.expireAt && entry.expireAt <= now) continue;
    if (regex.test(key)) keys.push({ key, type: entry.type });
    if (keys.length >= limit) break;
  }
  ok(res, keys, { namespace: ns, count: keys.length });
}

// DELETE /api/kv/:ns  - 清空命名空间
async function handleFlushNamespace(req, res, ns) {
  const space = store.get(ns);
  const count = space ? space.size : 0;
  store.delete(ns);
  appendAof({ cmd: 'FLUSH', ns });
  ok(res, { namespace: ns, cleared: count });
}

// POST /api/admin/snapshot - 手动触发快照
async function handleSnapshot(req, res) {
  try {
    takeSnapshot();
    ok(res, { message: '快照已生成', file: SNAPSHOT_FILE });
  } catch (e) {
    err(res, 500, '快照失败: ' + e.message);
  }
}

// GET /api/admin/stats
async function handleStats(req, res) {
  let totalKeys = 0;
  let withTtl = 0;
  const now = Date.now();
  for (const space of store.values()) {
    for (const entry of space.values()) {
      if (entry.expireAt && entry.expireAt <= now) continue;
      totalKeys++;
      if (entry.expireAt) withTtl++;
    }
  }
  ok(res, {
    namespaces: store.size,
    totalKeys,
    keysWithTtl: withTtl,
    memoryUsage: process.memoryUsage().heapUsed,
    uptime: process.uptime(),
    aofSize: fs.existsSync(AOF_FILE) ? fs.statSync(AOF_FILE).size : 0,
    snapshotSize: fs.existsSync(SNAPSHOT_FILE) ? fs.statSync(SNAPSHOT_FILE).size : 0,
  });
}

// ─── 路由 ──────────────────────────────────────────────

async function handler(req, res) {
  const method = req.method;
  const { segments } = parsePath(req.url);

  try {
    // GET /api/namespaces
    if (
      method === 'GET' &&
      segments.length === 2 &&
      segments[0] === 'api' &&
      segments[1] === 'namespaces'
    ) {
      return await handleListNamespaces(req, res);
    }

    // 管理接口 /api/admin/*
    if (segments[0] === 'api' && segments[1] === 'admin') {
      if (method === 'POST' && segments.length === 3 && segments[2] === 'snapshot') {
        return await handleSnapshot(req, res);
      }
      if (method === 'GET' && segments.length === 3 && segments[2] === 'stats') {
        return await handleStats(req, res);
      }
    }

    // /api/kv/:ns/...
    if (segments[0] === 'api' && segments[1] === 'kv' && segments.length >= 3) {
      const ns = segments[2];

      // GET /api/kv/:ns - 列出键
      if (method === 'GET' && segments.length === 3) {
        return await handleListKeys(req, res, ns);
      }

      // DELETE /api/kv/:ns - 清空命名空间
      if (method === 'DELETE' && segments.length === 3) {
        return await handleFlushNamespace(req, res, ns);
      }

      if (segments.length >= 4) {
        const key = decodeURIComponent(segments[3]);

        // /api/kv/:ns/:key
        if (segments.length === 4) {
          if (method === 'GET') return await handleGet(req, res, ns, key);
          if (method === 'PUT') return await handleSet(req, res, ns, key);
          if (method === 'DELETE') return await handleDel(req, res, ns, key);
        }

        // /api/kv/:ns/:key/<subresource>
        if (segments.length === 5) {
          const sub = segments[4];

          if (sub === 'exists' && method === 'GET') return await handleExists(req, res, ns, key);

          if (sub === 'ttl' && method === 'GET') return await handleTtl(req, res, ns, key);

          if (sub === 'expire') {
            if (method === 'PUT') return await handleExpire(req, res, ns, key);
            if (method === 'DELETE') return await handlePersist(req, res, ns, key);
          }

          if (sub === 'incr' && method === 'POST') return await handleIncr(req, res, ns, key, 1);
          if (sub === 'decr' && method === 'POST') return await handleIncr(req, res, ns, key, -1);

          if (sub === 'list' && method === 'GET') return await handleListRange(req, res, ns, key);

          if (sub === 'hash') {
            if (method === 'GET') return await handleHashGet(req, res, ns, key);
            if (method === 'PUT') return await handleHashSet(req, res, ns, key);
            if (method === 'DELETE') return await handleHashDel(req, res, ns, key);
          }

          if (sub === 'set' && method === 'GET') return await handleSetMembers(req, res, ns, key);
        }

        // /api/kv/:ns/:key/list/push|pop
        if (segments.length === 6 && segments[4] === 'list') {
          if (segments[5] === 'push' && method === 'POST')
            return await handleListPush(req, res, ns, key);
          if (segments[5] === 'pop' && method === 'POST')
            return await handleListPop(req, res, ns, key);
        }

        // /api/kv/:ns/:key/set/add|remove
        if (segments.length === 6 && segments[4] === 'set') {
          if (segments[5] === 'add' && method === 'POST')
            return await handleSetAdd(req, res, ns, key);
          if (segments[5] === 'remove' && method === 'POST')
            return await handleSetRemove(req, res, ns, key);
        }
      }
    }

    err(res, 404, '接口未找到');
  } catch (e) {
    if (e.message === '无效的 JSON 格式') {
      return err(res, 400, '请求体不是有效的 JSON');
    }
    console.error('服务器错误:', e);
    err(res, 500, '服务器内部错误');
  }
}

// ─── 启动 ──────────────────────────────────────────────

loadFromDisk();

const expireTimer = setInterval(scanExpired, EXPIRE_SCAN_INTERVAL_MS);
const snapshotTimer = setInterval(() => {
  try {
    takeSnapshot();
  } catch (e) {
    console.error('自动快照失败:', e.message);
  }
}, SNAPSHOT_INTERVAL_MS);

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log('本地 KV 存储服务已启动');
  console.log(`   地址: http://localhost:${PORT}`);
  console.log('   持久化: AOF + 快照');
  console.log('   接口:');
  console.log('     GET    /api/namespaces                                 - 列出所有命名空间');
  console.log('     GET    /api/kv/:ns?pattern=*&limit=100                  - 列出命名空间下的键');
  console.log('     DELETE /api/kv/:ns                                     - 清空命名空间');
  console.log('     GET    /api/kv/:ns/:key                                - 读取键');
  console.log('     PUT    /api/kv/:ns/:key            body:{value,ttl?}   - 写入键');
  console.log('     DELETE /api/kv/:ns/:key                                - 删除键');
  console.log('     GET    /api/kv/:ns/:key/exists                         - 判断是否存在');
  console.log('     GET    /api/kv/:ns/:key/ttl                            - 查询 TTL');
  console.log('     PUT    /api/kv/:ns/:key/expire     body:{ttl}          - 设置过期时间(ms)');
  console.log('     DELETE /api/kv/:ns/:key/expire                         - 移除过期时间');
  console.log('     POST   /api/kv/:ns/:key/incr       body:{by?}          - 数值自增');
  console.log('     POST   /api/kv/:ns/:key/decr       body:{by?}          - 数值自减');
  console.log('     POST   /api/kv/:ns/:key/list/push  body:{values,direction?} - 列表追加');
  console.log('     POST   /api/kv/:ns/:key/list/pop   body:{direction?}   - 列表弹出');
  console.log('     GET    /api/kv/:ns/:key/list?start=0&end=-1            - 列表区间');
  console.log('     PUT    /api/kv/:ns/:key/hash       body:{fields}       - 哈希字段写入');
  console.log('     GET    /api/kv/:ns/:key/hash[?field=]                  - 哈希字段读取');
  console.log('     DELETE /api/kv/:ns/:key/hash       body:{fields}       - 哈希字段删除');
  console.log('     POST   /api/kv/:ns/:key/set/add    body:{members}      - 集合添加');
  console.log('     POST   /api/kv/:ns/:key/set/remove body:{members}      - 集合移除');
  console.log('     GET    /api/kv/:ns/:key/set                            - 集合成员');
  console.log('     POST   /api/admin/snapshot                             - 手动触发快照');
  console.log('     GET    /api/admin/stats                                - 服务状态');
});

// ─── 优雅退出 ──────────────────────────────────────────────

function shutdown() {
  console.log('\n正在关闭服务，保存快照...');
  clearInterval(expireTimer);
  clearInterval(snapshotTimer);
  try {
    takeSnapshot();
  } catch (e) {
    console.error('退出时快照失败:', e.message);
  }
  if (aofStream) aofStream.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
