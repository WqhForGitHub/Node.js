const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3032;
const DATA_DIR = path.join(__dirname, "data");
const COMMENTS_FILE = path.join(DATA_DIR, "comments.json");
const REACTIONS_FILE = path.join(DATA_DIR, "reactions.json");

// ==================== 数据存储 ====================

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function loadData(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`读取 ${filePath} 失败:`, e.message);
  }
  return defaultVal;
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`写入 ${filePath} 失败:`, e.message);
  }
}

// 内存数据（启动时从文件加载）
let comments = loadData(COMMENTS_FILE, []);
let reactions = loadData(REACTIONS_FILE, {});

// 持久化
function persist() {
  saveData(COMMENTS_FILE, comments);
  saveData(REACTIONS_FILE, reactions);
}

// ==================== 工具函数 ====================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

function sendSuccess(res, data, extra = {}) {
  send(res, 200, { success: true, data, ...extra });
}

function sendError(res, statusCode, error) {
  send(res, statusCode, { success: false, error });
}

// 构建评论树（将扁平评论组织为嵌套结构）
function buildCommentTree(targetId, targetType) {
  const filtered = comments.filter(
    (c) => c.targetId === targetId && c.targetType === targetType && !c.deleted,
  );
  const map = {};
  const roots = [];

  filtered.forEach((c) => {
    map[c.id] = { ...c, replies: [] };
  });

  filtered.forEach((c) => {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].replies.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });

  return roots;
}

// 统计评论数
function countComments(targetId, targetType) {
  return comments.filter(
    (c) => c.targetId === targetId && c.targetType === targetType && !c.deleted,
  ).length;
}

// 查找评论
function findComment(id) {
  return comments.find((c) => c.id === id && !c.deleted);
}

// 查找所有后代评论（递归）
function findDescendants(parentId) {
  const result = [];
  const children = comments.filter(
    (c) => c.parentId === parentId && !c.deleted,
  );
  for (const child of children) {
    result.push(child);
    result.push(...findDescendants(child.id));
  }
  return result;
}

// ==================== API 处理函数 ====================

// POST /api/comments - 创建评论
async function createComment(req, res) {
  const body = await parseBody(req);
  const { targetId, targetType, parentId, author, content } = body;

  if (!targetId || !targetType || !author || !content) {
    return sendError(
      res,
      400,
      "缺少必填字段: targetId, targetType, author, content",
    );
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    return sendError(res, 400, "评论内容不能为空");
  }

  if (content.length > 2000) {
    return sendError(res, 400, "评论内容不能超过2000个字符");
  }

  // 如果是回复，校验父评论存在且属于同一目标
  if (parentId) {
    const parent = findComment(parentId);
    if (!parent) {
      return sendError(res, 404, "父评论不存在");
    }
    if (parent.targetId !== targetId || parent.targetType !== targetType) {
      return sendError(res, 400, "父评论与当前目标不匹配");
    }
  }

  const validTypes = ["post", "article", "page", "video"];
  if (!validTypes.includes(targetType)) {
    return sendError(res, 400, `targetType 必须是: ${validTypes.join(", ")}`);
  }

  const comment = {
    id: crypto.randomUUID(),
    targetId,
    targetType,
    parentId: parentId || null,
    author: author.trim(),
    content: content.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  };

  comments.push(comment);
  persist();

  send(res, 201, { success: true, data: comment });
}

// GET /api/comments?targetId=xxx&targetType=post - 获取评论列表（树形结构）
function getComments(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { targetId, targetType, flat } = parsedUrl.query;

  if (!targetId || !targetType) {
    return sendError(res, 400, "缺少查询参数: targetId, targetType");
  }

  const filtered = comments.filter(
    (c) => c.targetId === targetId && c.targetType === targetType && !c.deleted,
  );

  // 附加反应数据
  const enriched = filtered.map((c) => ({
    ...c,
    reactions: reactions[c.id] || {},
  }));

  if (flat === "true") {
    return sendSuccess(res, enriched, { count: enriched.length });
  }

  // 树形结构
  const tree = buildCommentTree(targetId, targetType);
  const attachReactions = (nodes) =>
    nodes.map((n) => ({
      ...n,
      reactions: reactions[n.id] || {},
      replies: attachReactions(n.replies || []),
    }));

  sendSuccess(res, attachReactions(tree), { count: enriched.length });
}

// GET /api/comments/:id - 获取单条评论
function getComment(req, res, id) {
  const comment = findComment(id);
  if (!comment) {
    return sendError(res, 404, "评论不存在");
  }
  sendSuccess(res, { ...comment, reactions: reactions[id] || {} });
}

// PUT /api/comments/:id - 更新评论
async function updateComment(req, res, id) {
  const comment = findComment(id);
  if (!comment) {
    return sendError(res, 404, "评论不存在");
  }

  const body = await parseBody(req);
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return sendError(res, 400, "评论内容不能为空");
  }

  if (content.length > 2000) {
    return sendError(res, 400, "评论内容不能超过2000个字符");
  }

  comment.content = content.trim();
  comment.updatedAt = new Date().toISOString();
  persist();

  sendSuccess(res, comment);
}

// DELETE /api/comments/:id - 删除评论（软删除）
function deleteComment(req, res, id) {
  const comment = comments.find((c) => c.id === id);
  if (!comment || comment.deleted) {
    return sendError(res, 404, "评论不存在");
  }

  // 软删除评论及其所有后代
  comment.deleted = true;
  comment.deletedAt = new Date().toISOString();
  const descendants = findDescendants(id);
  descendants.forEach((d) => {
    d.deleted = true;
    d.deletedAt = new Date().toISOString();
  });

  persist();

  sendSuccess(res, {
    message: "评论已删除",
    deletedCount: 1 + descendants.length,
  });
}

// POST /api/comments/:id/react - 对评论进行反应（点赞/踩等）
async function reactToComment(req, res, id) {
  const comment = findComment(id);
  if (!comment) {
    return sendError(res, 404, "评论不存在");
  }

  const body = await parseBody(req);
  const { type, action } = body;

  const validTypes = ["like", "dislike", "love", "wow", "angry"];
  if (!type || !validTypes.includes(type)) {
    return sendError(res, 400, `type 必须是: ${validTypes.join(", ")}`);
  }

  if (!reactions[id]) {
    reactions[id] = {};
  }

  if (action === "remove") {
    reactions[id][type] = Math.max(0, (reactions[id][type] || 0) - 1);
  } else {
    reactions[id][type] = (reactions[id][type] || 0) + 1;
  }

  persist();

  sendSuccess(res, { commentId: id, reactions: reactions[id] });
}

// GET /api/comments/:id/reactions - 获取评论的反应统计
function getReactions(req, res, id) {
  const comment = findComment(id);
  if (!comment) {
    return sendError(res, 404, "评论不存在");
  }
  sendSuccess(res, { commentId: id, reactions: reactions[id] || {} });
}

// GET /api/stats?targetId=xxx&targetType=post - 获取评论统计
function getStats(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { targetId, targetType } = parsedUrl.query;

  if (!targetId || !targetType) {
    return sendError(res, 400, "缺少查询参数: targetId, targetType");
  }

  const filtered = comments.filter(
    (c) => c.targetId === targetId && c.targetType === targetType && !c.deleted,
  );

  const topLevel = filtered.filter((c) => !c.parentId).length;
  const replies = filtered.filter((c) => c.parentId).length;
  const authors = [...new Set(filtered.map((c) => c.author))];

  // 最近评论
  const recent = [...filtered]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      author: c.author,
      content: c.content.substring(0, 50),
      createdAt: c.createdAt,
    }));

  sendSuccess(res, {
    targetId,
    targetType,
    total: filtered.length,
    topLevel,
    replies,
    uniqueAuthors: authors.length,
    authors,
    recentComments: recent,
  });
}

// ==================== 路由处理 ====================

async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    // POST /api/comments
    if (method === "POST" && pathname === "/api/comments") {
      return await createComment(req, res);
    }

    // GET /api/comments (列表)
    if (method === "GET" && pathname === "/api/comments") {
      return getComments(req, res);
    }

    // GET /api/stats
    if (method === "GET" && pathname === "/api/stats") {
      return getStats(req, res);
    }

    // /api/comments/:id 子路由
    const commentMatch = pathname.match(/^\/api\/comments\/([\w-]+)$/);
    if (commentMatch) {
      const id = commentMatch[1];

      // GET /api/comments/:id
      if (method === "GET") {
        return getComment(req, res, id);
      }

      // PUT /api/comments/:id
      if (method === "PUT") {
        return await updateComment(req, res, id);
      }

      // DELETE /api/comments/:id
      if (method === "DELETE") {
        return deleteComment(req, res, id);
      }
    }

    // POST /api/comments/:id/react
    const reactMatch = pathname.match(/^\/api\/comments\/([\w-]+)\/react$/);
    if (reactMatch && method === "POST") {
      return await reactToComment(req, res, reactMatch[1]);
    }

    // GET /api/comments/:id/reactions
    const reactionsMatch = pathname.match(
      /^\/api\/comments\/([\w-]+)\/reactions$/,
    );
    if (reactionsMatch && method === "GET") {
      return getReactions(req, res, reactionsMatch[1]);
    }

    sendError(res, 404, "Route not found");
  } catch (err) {
    if (err.message === "Invalid JSON") {
      return sendError(res, 400, "Invalid JSON");
    }
    console.error("服务器错误:", err);
    sendError(res, 500, "Internal server error");
  }
}

// ==================== 启动服务器 ====================

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║               🗨️  评论系统 API 已启动                    ║
╠══════════════════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                            ║
╠══════════════════════════════════════════════════════════╣
║  API 端点:                                               ║
║                                                          ║
║  POST   /api/comments                     创建评论       ║
║  GET    /api/comments?targetId=&targetType= 获取评论列表  ║
║  GET    /api/comments/:id                 获取单条评论   ║
║  PUT    /api/comments/:id                 更新评论       ║
║  DELETE /api/comments/:id                 删除评论       ║
║  POST   /api/comments/:id/react           评论反应       ║
║  GET    /api/comments/:id/reactions       获取反应统计   ║
║  GET    /api/stats?targetId=&targetType=  评论统计       ║
╠══════════════════════════════════════════════════════════╣
║  数据目录: ${DATA_DIR}
╚══════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n正在关闭服务器...");
  persist();
  server.close(() => {
    console.log("服务器已关闭，数据已保存");
    process.exit(0);
  });
});
