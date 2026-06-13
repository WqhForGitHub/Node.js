/**
 * 基于 JSON 文件的数据持久化存储
 * 管理短链映射关系及访问统计
 */

const fs = require("fs");
const path = require("path");
const shortCode = require("./shortCode");

const DATA_FILE = path.join(__dirname, "data.json");

/**
 * 默认数据结构
 */
function getDefaultData() {
  return {
    nextId: 1, // 自增 ID 计数器
    urls: {}, // shortCode -> { id, originalUrl, createdAt, visits }
    urlIndex: {}, // originalUrl -> shortCode (防止重复)
  };
}

/**
 * 从文件加载数据，文件不存在则初始化
 * @returns {object} 数据对象
 */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("数据文件读取失败，将重新初始化:", err.message);
  }
  return getDefaultData();
}

/**
 * 将数据写入文件
 * @param {object} data - 数据对象
 */
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 创建短链
 * @param {string} originalUrl - 原始 URL
 * @returns {object} { code, originalUrl, createdAt, isNew }
 */
function createShortUrl(originalUrl) {
  const data = loadData();

  // 检查是否已存在相同 URL
  if (data.urlIndex[originalUrl]) {
    const existingCode = data.urlIndex[originalUrl];
    return {
      code: existingCode,
      originalUrl,
      createdAt: data.urls[existingCode].createdAt,
      isNew: false,
    };
  }

  // 生成新短码
  const id = data.nextId;
  const code = shortCode.encode(id);
  const createdAt = new Date().toISOString();

  data.urls[code] = {
    id,
    originalUrl,
    createdAt,
    visits: 0,
  };
  data.urlIndex[originalUrl] = code;
  data.nextId = id + 1;

  saveData(data);

  return { code, originalUrl, createdAt, isNew: true };
}

/**
 * 通过短码获取原始 URL，并增加访问计数
 * @param {string} code - 短码
 * @returns {object|null} { originalUrl, visits, createdAt } 或 null
 */
function getByCode(code) {
  const data = loadData();
  const entry = data.urls[code];
  if (!entry) return null;

  // 增加访问计数
  entry.visits += 1;
  saveData(data);

  return {
    originalUrl: entry.originalUrl,
    visits: entry.visits,
    createdAt: entry.createdAt,
  };
}

/**
 * 获取短链信息（不增加访问计数）
 * @param {string} code - 短码
 * @returns {object|null} 短链信息或 null
 */
function getInfo(code) {
  const data = loadData();
  const entry = data.urls[code];
  if (!entry) return null;

  return {
    code,
    originalUrl: entry.originalUrl,
    visits: entry.visits,
    createdAt: entry.createdAt,
  };
}

/**
 * 获取所有短链列表
 * @returns {Array} 短链信息数组
 */
function listAll() {
  const data = loadData();
  return Object.keys(data.urls).map((code) => ({
    code,
    originalUrl: data.urls[code].originalUrl,
    visits: data.urls[code].visits,
    createdAt: data.urls[code].createdAt,
  }));
}

/**
 * 删除短链
 * @param {string} code - 短码
 * @returns {boolean} 是否删除成功
 */
function deleteByCode(code) {
  const data = loadData();
  const entry = data.urls[code];
  if (!entry) return false;

  // 同时移除反向索引
  delete data.urlIndex[entry.originalUrl];
  delete data.urls[code];
  saveData(data);
  return true;
}

module.exports = {
  createShortUrl,
  getByCode,
  getInfo,
  listAll,
  deleteByCode,
};
