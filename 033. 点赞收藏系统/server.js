const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3033;
const DATA_DIR = path.join(__dirname, "data");
const LIKES_FILE = path.join(DATA_DIR, "likes.json");
const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const TARGETS_FILE = path.join(DATA_DIR, "targets.json");

// ==================== 数据存储 ====================

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
// likes: { [targetId]: { [userId]: { createdAt, targetType } } }
let likes = loadData(LIKES_FILE, {});
// favorites: { [targetId]: { [userId]: { createdAt, targetType, note } } }
let favorites = loadData(FAVORITES_FILE, {});
// targets: { [targetId]: { type, title, likeCount, favoriteCount } }
let targets = loadData(TARGETS_FILE, {});

// 持久化（防抖 300ms）
let persistTimer = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveData(LIKES_FILE, likes);
    saveData(FAVORITES_FILE, favorites);
    saveData(TARGETS_FILE, targets);
  }, 300);
}

// 优雅关闭时立即保存
function persistNow() {
  saveData(LIKES_FILE, likes);
  saveData(FAVORITES_FILE, favorites);
  saveData(TARGETS_FILE, targets);
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

// 确保目标存在
function ensureTarget(targetId, targetType, title) {
  if (!targets[targetId]) {
    targets[targetId] = {
      type: targetType,
      title: title || targetId,
      likeCount: 0,
      favoriteCount: 0,
      createdAt: new Date().toISOString(),
    };
  }
  if (title && targets[targetId].title === targetId) {
    targets[targetId].title = title;
  }
}

// 重新计算目标的点赞/收藏数
function recalcTarget(targetId) {
  if (!targets[targetId]) return;
  targets[targetId].likeCount = Object.keys(likes[targetId] || {}).length;
  targets[targetId].favoriteCount = Object.keys(
    favorites[targetId] || {},
  ).length;
}

// ==================== 点赞 API ====================

// POST /api/like - 点赞
async function addLike(req, res) {
  const body = await parseBody(req);
  const { targetId, targetType, userId, title } = body;

  if (!targetId || !targetType || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, targetType, userId");
  }

  const validTypes = [
    "post",
    "article",
    "comment",
    "video",
    "photo",
    "product",
  ];
  if (!validTypes.includes(targetType)) {
    return sendError(res, 400, `targetType 必须是: ${validTypes.join(", ")}`);
  }

  ensureTarget(targetId, targetType, title);

  // 检查是否已点赞
  if (likes[targetId] && likes[targetId][userId]) {
    return sendError(res, 409, "已经点过赞了");
  }

  if (!likes[targetId]) likes[targetId] = {};
  likes[targetId][userId] = {
    createdAt: new Date().toISOString(),
    targetType,
  };

  recalcTarget(targetId);
  persist();

  send(res, 201, {
    success: true,
    data: {
      targetId,
      userId,
      liked: true,
      likeCount: targets[targetId].likeCount,
    },
  });
}

// DELETE /api/like - 取消点赞
async function removeLike(req, res) {
  const body = await parseBody(req);
  const { targetId, userId } = body;

  if (!targetId || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, userId");
  }

  if (!likes[targetId] || !likes[targetId][userId]) {
    return sendError(res, 404, "尚未点赞");
  }

  delete likes[targetId][userId];
  if (Object.keys(likes[targetId]).length === 0) {
    delete likes[targetId];
  }

  recalcTarget(targetId);
  persist();

  sendSuccess(res, {
    targetId,
    userId,
    liked: false,
    likeCount: targets[targetId] ? targets[targetId].likeCount : 0,
  });
}

// POST /api/like/toggle - 点赞/取消点赞切换
async function toggleLike(req, res) {
  const body = await parseBody(req);
  const { targetId, targetType, userId, title } = body;

  if (!targetId || !targetType || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, targetType, userId");
  }

  ensureTarget(targetId, targetType, title);

  if (likes[targetId] && likes[targetId][userId]) {
    // 已点赞 -> 取消
    delete likes[targetId][userId];
    if (Object.keys(likes[targetId]).length === 0) {
      delete likes[targetId];
    }
    recalcTarget(targetId);
    persist();

    return sendSuccess(res, {
      targetId,
      userId,
      liked: false,
      likeCount: targets[targetId].likeCount,
    });
  } else {
    // 未点赞 -> 点赞
    if (!likes[targetId]) likes[targetId] = {};
    likes[targetId][userId] = {
      createdAt: new Date().toISOString(),
      targetType,
    };
    recalcTarget(targetId);
    persist();

    return send(res, 201, {
      success: true,
      data: {
        targetId,
        userId,
        liked: true,
        likeCount: targets[targetId].likeCount,
      },
    });
  }
}

// ==================== 收藏 API ====================

// POST /api/favorite - 收藏
async function addFavorite(req, res) {
  const body = await parseBody(req);
  const { targetId, targetType, userId, title, note } = body;

  if (!targetId || !targetType || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, targetType, userId");
  }

  const validTypes = [
    "post",
    "article",
    "comment",
    "video",
    "photo",
    "product",
  ];
  if (!validTypes.includes(targetType)) {
    return sendError(res, 400, `targetType 必须是: ${validTypes.join(", ")}`);
  }

  ensureTarget(targetId, targetType, title);

  if (favorites[targetId] && favorites[targetId][userId]) {
    return sendError(res, 409, "已经收藏过了");
  }

  if (!favorites[targetId]) favorites[targetId] = {};
  favorites[targetId][userId] = {
    createdAt: new Date().toISOString(),
    targetType,
    note: note || "",
  };

  recalcTarget(targetId);
  persist();

  send(res, 201, {
    success: true,
    data: {
      targetId,
      userId,
      favorited: true,
      favoriteCount: targets[targetId].favoriteCount,
    },
  });
}

// DELETE /api/favorite - 取消收藏
async function removeFavorite(req, res) {
  const body = await parseBody(req);
  const { targetId, userId } = body;

  if (!targetId || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, userId");
  }

  if (!favorites[targetId] || !favorites[targetId][userId]) {
    return sendError(res, 404, "尚未收藏");
  }

  delete favorites[targetId][userId];
  if (Object.keys(favorites[targetId]).length === 0) {
    delete favorites[targetId];
  }

  recalcTarget(targetId);
  persist();

  sendSuccess(res, {
    targetId,
    userId,
    favorited: false,
    favoriteCount: targets[targetId] ? targets[targetId].favoriteCount : 0,
  });
}

// POST /api/favorite/toggle - 收藏/取消收藏切换
async function toggleFavorite(req, res) {
  const body = await parseBody(req);
  const { targetId, targetType, userId, title, note } = body;

  if (!targetId || !targetType || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, targetType, userId");
  }

  ensureTarget(targetId, targetType, title);

  if (favorites[targetId] && favorites[targetId][userId]) {
    delete favorites[targetId][userId];
    if (Object.keys(favorites[targetId]).length === 0) {
      delete favorites[targetId];
    }
    recalcTarget(targetId);
    persist();

    return sendSuccess(res, {
      targetId,
      userId,
      favorited: false,
      favoriteCount: targets[targetId].favoriteCount,
    });
  } else {
    if (!favorites[targetId]) favorites[targetId] = {};
    favorites[targetId][userId] = {
      createdAt: new Date().toISOString(),
      targetType,
      note: note || "",
    };
    recalcTarget(targetId);
    persist();

    return send(res, 201, {
      success: true,
      data: {
        targetId,
        userId,
        favorited: true,
        favoriteCount: targets[targetId].favoriteCount,
      },
    });
  }
}

// PUT /api/favorite/note - 更新收藏备注
async function updateFavoriteNote(req, res) {
  const body = await parseBody(req);
  const { targetId, userId, note } = body;

  if (!targetId || !userId) {
    return sendError(res, 400, "缺少必填字段: targetId, userId");
  }

  if (!favorites[targetId] || !favorites[targetId][userId]) {
    return sendError(res, 404, "尚未收藏");
  }

  favorites[targetId][userId].note = note || "";
  favorites[targetId][userId].updatedAt = new Date().toISOString();
  persist();

  sendSuccess(res, {
    targetId,
    userId,
    note: favorites[targetId][userId].note,
  });
}

// ==================== 查询 API ====================

// GET /api/status?targetId=xxx&userId=xxx - 获取用户对目标的点赞/收藏状态
function getStatus(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { targetId, userId } = parsedUrl.query;

  if (!targetId) {
    return sendError(res, 400, "缺少查询参数: targetId");
  }

  const target = targets[targetId];
  const likeCount = target ? target.likeCount : 0;
  const favoriteCount = target ? target.favoriteCount : 0;

  const result = {
    targetId,
    targetType: target ? target.type : null,
    title: target ? target.title : null,
    likeCount,
    favoriteCount,
  };

  if (userId) {
    result.liked = !!(likes[targetId] && likes[targetId][userId]);
    result.favorited = !!(favorites[targetId] && favorites[targetId][userId]);
    if (result.favorited) {
      result.favoriteNote = favorites[targetId][userId].note || "";
    }
  }

  sendSuccess(res, result);
}

// GET /api/targets?type=post - 获取所有目标列表
function getTargets(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { type, sort, limit, offset } = parsedUrl.query;

  let list = Object.entries(targets).map(([id, t]) => ({
    targetId: id,
    ...t,
  }));

  if (type) {
    list = list.filter((t) => t.type === type);
  }

  // 排序
  const sortField =
    sort === "likes"
      ? "likeCount"
      : sort === "favorites"
        ? "favoriteCount"
        : "createdAt";
  list.sort((a, b) => {
    if (sortField === "createdAt") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return b[sortField] - a[sortField];
  });

  // 分页
  const start = parseInt(offset) || 0;
  const take = parseInt(limit) || 50;
  const total = list.length;
  list = list.slice(start, start + take);

  sendSuccess(res, list, { total, offset: start, limit: take });
}

// GET /api/likes?targetId=xxx - 获取某目标的点赞用户列表
function getLikeUsers(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { targetId } = parsedUrl.query;

  if (!targetId) {
    return sendError(res, 400, "缺少查询参数: targetId");
  }

  const userMap = likes[targetId] || {};
  const users = Object.entries(userMap).map(([userId, info]) => ({
    userId,
    createdAt: info.createdAt,
  }));

  // 按时间倒序
  users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sendSuccess(res, users, { count: users.length });
}

// GET /api/favorites?targetId=xxx - 获取某目标的收藏用户列表
function getFavoriteUsers(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { targetId } = parsedUrl.query;

  if (!targetId) {
    return sendError(res, 400, "缺少查询参数: targetId");
  }

  const userMap = favorites[targetId] || {};
  const users = Object.entries(userMap).map(([userId, info]) => ({
    userId,
    note: info.note,
    createdAt: info.createdAt,
  }));

  users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sendSuccess(res, users, { count: users.length });
}

// GET /api/user/likes?userId=xxx - 获取用户点赞的所有目标
function getUserLikes(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { userId, type } = parsedUrl.query;

  if (!userId) {
    return sendError(res, 400, "缺少查询参数: userId");
  }

  const result = [];
  for (const [targetId, userMap] of Object.entries(likes)) {
    if (userMap[userId]) {
      const target = targets[targetId];
      if (type && target && target.type !== type) continue;
      result.push({
        targetId,
        targetType: target ? target.type : userMap[userId].targetType,
        title: target ? target.title : targetId,
        likeCount: target ? target.likeCount : 0,
        createdAt: userMap[userId].createdAt,
      });
    }
  }

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sendSuccess(res, result, { count: result.length });
}

// GET /api/user/favorites?userId=xxx - 获取用户收藏的所有目标
function getUserFavorites(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const { userId, type } = parsedUrl.query;

  if (!userId) {
    return sendError(res, 400, "缺少查询参数: userId");
  }

  const result = [];
  for (const [targetId, userMap] of Object.entries(favorites)) {
    if (userMap[userId]) {
      const target = targets[targetId];
      if (type && target && target.type !== type) continue;
      result.push({
        targetId,
        targetType: target ? target.type : userMap[userId].targetType,
        title: target ? target.title : targetId,
        favoriteCount: target ? target.favoriteCount : 0,
        note: userMap[userId].note,
        createdAt: userMap[userId].createdAt,
      });
    }
  }

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sendSuccess(res, result, { count: result.length });
}

// GET /api/stats - 全局统计
function getStats(req, res) {
  const totalTargets = Object.keys(targets).length;
  const totalLikes = Object.values(likes).reduce(
    (sum, userMap) => sum + Object.keys(userMap).length,
    0,
  );
  const totalFavorites = Object.values(favorites).reduce(
    (sum, userMap) => sum + Object.keys(userMap).length,
    0,
  );

  // 点赞数 Top 5
  const topLiked = Object.entries(targets)
    .sort((a, b) => b[1].likeCount - a[1].likeCount)
    .slice(0, 5)
    .map(([id, t]) => ({
      targetId: id,
      title: t.title,
      likeCount: t.likeCount,
    }));

  // 收藏数 Top 5
  const topFavorited = Object.entries(targets)
    .sort((a, b) => b[1].favoriteCount - a[1].favoriteCount)
    .slice(0, 5)
    .map(([id, t]) => ({
      targetId: id,
      title: t.title,
      favoriteCount: t.favoriteCount,
    }));

  sendSuccess(res, {
    totalTargets,
    totalLikes,
    totalFavorites,
    topLiked,
    topFavorited,
  });
}

// ==================== 前端页面 ====================

function serveHTML(req, res) {
  const htmlPath = path.join(__dirname, "index.html");
  try {
    const html = fs.readFileSync(htmlPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    sendError(res, 404, "前端页面未找到");
  }
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
    // 前端页面
    if (method === "GET" && pathname === "/") {
      return serveHTML(req, res);
    }

    // ===== 点赞 API =====
    // POST /api/like - 点赞
    if (method === "POST" && pathname === "/api/like") {
      return await addLike(req, res);
    }
    // DELETE /api/like - 取消点赞
    if (method === "DELETE" && pathname === "/api/like") {
      return await removeLike(req, res);
    }
    // POST /api/like/toggle - 点赞切换
    if (method === "POST" && pathname === "/api/like/toggle") {
      return await toggleLike(req, res);
    }
    // GET /api/likes - 获取点赞用户列表
    if (method === "GET" && pathname === "/api/likes") {
      return getLikeUsers(req, res);
    }

    // ===== 收藏 API =====
    // POST /api/favorite - 收藏
    if (method === "POST" && pathname === "/api/favorite") {
      return await addFavorite(req, res);
    }
    // DELETE /api/favorite - 取消收藏
    if (method === "DELETE" && pathname === "/api/favorite") {
      return await removeFavorite(req, res);
    }
    // POST /api/favorite/toggle - 收藏切换
    if (method === "POST" && pathname === "/api/favorite/toggle") {
      return await toggleFavorite(req, res);
    }
    // PUT /api/favorite/note - 更新收藏备注
    if (method === "PUT" && pathname === "/api/favorite/note") {
      return await updateFavoriteNote(req, res);
    }
    // GET /api/favorites - 获取收藏用户列表
    if (method === "GET" && pathname === "/api/favorites") {
      return getFavoriteUsers(req, res);
    }

    // ===== 查询 API =====
    // GET /api/status - 获取用户对目标的状态
    if (method === "GET" && pathname === "/api/status") {
      return getStatus(req, res);
    }
    // GET /api/targets - 获取目标列表
    if (method === "GET" && pathname === "/api/targets") {
      return getTargets(req, res);
    }
    // GET /api/user/likes - 获取用户点赞列表
    if (method === "GET" && pathname === "/api/user/likes") {
      return getUserLikes(req, res);
    }
    // GET /api/user/favorites - 获取用户收藏列表
    if (method === "GET" && pathname === "/api/user/favorites") {
      return getUserFavorites(req, res);
    }
    // GET /api/stats - 全局统计
    if (method === "GET" && pathname === "/api/stats") {
      return getStats(req, res);
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
╔══════════════════════════════════════════════════════════════╗
║               点赞收藏系统 API 已启动                         ║
╠══════════════════════════════════════════════════════════════╣
║  地址: http://localhost:${PORT}                                ║
║  前端: http://localhost:${PORT}/                               ║
╠══════════════════════════════════════════════════════════════╣
║  点赞 API:                                                   ║
║  POST   /api/like               点赞                        ║
║  DELETE /api/like               取消点赞                    ║
║  POST   /api/like/toggle        点赞/取消切换               ║
║  GET    /api/likes?targetId=    获取点赞用户列表             ║
╠══════════════════════════════════════════════════════════════╣
║  收藏 API:                                                   ║
║  POST   /api/favorite           收藏                        ║
║  DELETE /api/favorite           取消收藏                    ║
║  POST   /api/favorite/toggle    收藏/取消切换               ║
║  PUT    /api/favorite/note      更新收藏备注                ║
║  GET    /api/favorites?targetId= 获取收藏用户列表            ║
╠══════════════════════════════════════════════════════════════╣
║  查询 API:                                                   ║
║  GET /api/status?targetId=&userId=  查询用户状态             ║
║  GET /api/targets?type=&sort=       目标列表                 ║
║  GET /api/user/likes?userId=        用户点赞列表             ║
║  GET /api/user/favorites?userId=    用户收藏列表             ║
║  GET /api/stats                     全局统计                 ║
╠══════════════════════════════════════════════════════════════╣
║  数据目录: ${DATA_DIR}
╚══════════════════════════════════════════════════════════════╝
  `);
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n正在关闭服务器...");
  persistNow();
  server.close(() => {
    console.log("服务器已关闭，数据已保存");
    process.exit(0);
  });
});
