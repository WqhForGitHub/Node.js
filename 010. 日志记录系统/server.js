const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3000;
const LOG_DIR = path.join(__dirname, "logs");

// ============================================================
// 1. 日志级别定义
// ============================================================
const LOG_LEVELS = {
  DEBUG: { value: 0, color: "\x1b[36m", label: "DEBUG" }, // 青色
  INFO: { value: 10, color: "\x1b[32m", label: "INFO" }, // 绿色
  WARN: { value: 20, color: "\x1b[33m", label: "WARN" }, // 黄色
  ERROR: { value: 30, color: "\x1b[31m", label: "ERROR" }, // 红色
  FATAL: { value: 40, color: "\x1b[35m", label: "FATAL" }, // 紫色
};

const RESET_COLOR = "\x1b[0m";

// ============================================================
// 2. 日志格式化器
// ============================================================
class LogFormatter {
  /**
   * 格式化日志条目为文本行
   * @param {object} entry - 日志条目
   * @returns {string} 格式化后的文本
   */
  static formatText(entry) {
    const { timestamp, level, message, meta } = entry;
    const metaStr =
      meta && Object.keys(meta).length > 0
        ? " " +
          Object.entries(meta)
            .map(
              ([k, v]) =>
                `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`,
            )
            .join(" ")
        : "";
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * 格式化日志条目为带颜色的文本（控制台用）
   */
  static formatColorText(entry) {
    const levelInfo = LOG_LEVELS[entry.level] || LOG_LEVELS.INFO;
    const plain = LogFormatter.formatText(entry);
    return `${levelInfo.color}${plain}${RESET_COLOR}`;
  }

  /**
   * 格式化日志条目为 JSON 字符串
   */
  static formatJson(entry) {
    return JSON.stringify(entry);
  }
}

// ============================================================
// 3. 日志传输器（Transport）—— 控制台输出
// ============================================================
class ConsoleTransport {
  constructor(options = {}) {
    this.level = options.level || "DEBUG";
    this.formatter = options.formatter || LogFormatter.formatColorText;
  }

  write(entry) {
    const levelValue = LOG_LEVELS[entry.level]?.value ?? 0;
    const thresholdValue = LOG_LEVELS[this.level]?.value ?? 0;
    if (levelValue < thresholdValue) return;

    const output = this.formatter(entry);
    if (entry.level === "ERROR" || entry.level === "FATAL") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }
}

// ============================================================
// 4. 日志传输器（Transport）—— 文件输出（含日志轮转）
// ============================================================
class FileTransport {
  /**
   * @param {object} options
   * @param {string} options.filename - 日志文件名
   * @param {string} [options.level] - 最低日志级别
   * @param {number} [options.maxSize] - 单个日志文件最大字节数，超过后轮转
   * @param {number} [options.maxFiles] - 保留的轮转日志文件数量
   * @param {Function} [options.formatter] - 格式化函数
   */
  constructor(options = {}) {
    this.filename = options.filename || "app.log";
    this.filepath = path.join(LOG_DIR, this.filename);
    this.level = options.level || "DEBUG";
    this.maxSize = options.maxSize || 5 * 1024 * 1024; // 默认 5MB
    this.maxFiles = options.maxFiles || 5;
    this.formatter = options.formatter || LogFormatter.formatText;

    // 确保日志目录存在
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  write(entry) {
    const levelValue = LOG_LEVELS[entry.level]?.value ?? 0;
    const thresholdValue = LOG_LEVELS[this.level]?.value ?? 0;
    if (levelValue < thresholdValue) return;

    // 检查是否需要轮转
    this._rotateIfNeeded();

    const output = this.formatter(entry) + "\n";
    fs.appendFileSync(this.filepath, output, "utf-8");
  }

  _rotateIfNeeded() {
    if (!fs.existsSync(this.filepath)) return;

    const stats = fs.statSync(this.filepath);
    if (stats.size < this.maxSize) return;

    // 轮转：app.log -> app.1.log, app.1.log -> app.2.log, ...
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = path.join(LOG_DIR, `${this.filename}.${i}`);
      const newPath = path.join(LOG_DIR, `${this.filename}.${i + 1}`);
      if (fs.existsSync(oldPath)) {
        if (i + 1 > this.maxFiles) {
          fs.unlinkSync(oldPath); // 超出最大文件数则删除
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // 将当前日志文件重命名为 .1
    const firstRotate = path.join(LOG_DIR, `${this.filename}.1`);
    fs.renameSync(this.filepath, firstRotate);
  }

  /**
   * 读取当前日志文件内容
   */
  readCurrentLogs() {
    if (!fs.existsSync(this.filepath)) return "";
    return fs.readFileSync(this.filepath, "utf-8");
  }
}

// ============================================================
// 5. 核心日志记录器（Logger）
// ============================================================
class Logger {
  /**
   * @param {object} options
   * @param {string} [options.level] - 全局最低日志级别
   * @param {string} [options.category] - 日志分类/模块名
   */
  constructor(options = {}) {
    this.level = options.level || "DEBUG";
    this.category = options.category || "default";
    this.transports = [];
  }

  /**
   * 添加传输器
   */
  addTransport(transport) {
    this.transports.push(transport);
    return this;
  }

  /**
   * 创建日志条目对象
   */
  _createEntry(level, message, meta = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      category: this.category,
      message,
      meta: meta || {},
    };
  }

  /**
   * 写入日志（核心方法）
   */
  _log(level, message, meta) {
    const levelValue = LOG_LEVELS[level]?.value ?? 0;
    const thresholdValue = LOG_LEVELS[this.level]?.value ?? 0;
    if (levelValue < thresholdValue) return;

    const entry = this._createEntry(level, message, meta);
    for (const transport of this.transports) {
      transport.write(entry);
    }
  }

  debug(message, meta) {
    this._log("DEBUG", message, meta);
  }
  info(message, meta) {
    this._log("INFO", message, meta);
  }
  warn(message, meta) {
    this._log("WARN", message, meta);
  }
  error(message, meta) {
    this._log("ERROR", message, meta);
  }
  fatal(message, meta) {
    this._log("FATAL", message, meta);
  }

  /**
   * 创建子日志记录器（继承传输器，拥有独立分类）
   */
  child(category) {
    const childLogger = new Logger({ level: this.level, category });
    childLogger.transports = [...this.transports];
    return childLogger;
  }
}

// ============================================================
// 6. 创建全局日志实例
// ============================================================
const logger = new Logger({ level: "DEBUG" });

// 添加控制台传输器
logger.addTransport(new ConsoleTransport({ level: "DEBUG" }));

// 添加文件传输器（普通日志）
logger.addTransport(
  new FileTransport({
    filename: "app.log",
    level: "INFO",
    maxSize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
);

// 添加文件传输器（错误日志单独记录）
logger.addTransport(
  new FileTransport({
    filename: "error.log",
    level: "ERROR",
    maxSize: 5 * 1024 * 1024,
    maxFiles: 5,
  }),
);

// 为不同模块创建子日志记录器
const accessLogger = logger.child("access");
const apiLogger = logger.child("api");

// ============================================================
// 7. 日志查询工具
// ============================================================
class LogQuery {
  constructor() {
    this.appLogPath = path.join(LOG_DIR, "app.log");
    this.errorLogPath = path.join(LOG_DIR, "error.log");
  }

  /**
   * 查询日志
   * @param {object} options
   * @param {string} [options.level] - 过滤级别
   * @param {string} [options.category] - 过滤分类
   * @param {string} [options.search] - 关键词搜索
   * @param {string} [options.file] - 日志文件 (app | error)
   * @param {number} [options.limit] - 返回条数限制
   * @param {number} [options.offset] - 偏移量
   */
  query(options = {}) {
    const {
      level,
      category,
      search,
      file = "app",
      limit = 50,
      offset = 0,
    } = options;

    const filepath = file === "error" ? this.errorLogPath : this.appLogPath;
    if (!fs.existsSync(filepath)) {
      return { total: 0, logs: [] };
    }

    const content = fs.readFileSync(filepath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    let logs = lines.map((line) => this._parseLine(line)).filter(Boolean);

    // 按级别过滤
    if (level) {
      const levelValue = LOG_LEVELS[level.toUpperCase()]?.value;
      if (levelValue !== undefined) {
        logs = logs.filter((log) => {
          const logValue = LOG_LEVELS[log.level]?.value;
          return logValue !== undefined && logValue >= levelValue;
        });
      }
    }

    // 按分类过滤
    if (category) {
      logs = logs.filter((log) => log.category === category);
    }

    // 关键词搜索
    if (search) {
      const keyword = search.toLowerCase();
      logs = logs.filter(
        (log) =>
          log.message.toLowerCase().includes(keyword) ||
          JSON.stringify(log.meta).toLowerCase().includes(keyword),
      );
    }

    const total = logs.length;
    logs = logs.slice(offset, offset + limit);

    return { total, logs };
  }

  /**
   * 获取日志统计信息
   */
  stats() {
    const result = { app: {}, error: {} };

    for (const [key, filepath] of [
      ["app", this.appLogPath],
      ["error", this.errorLogPath],
    ]) {
      if (!fs.existsSync(filepath)) {
        result[key] = { size: 0, lines: 0, levels: {} };
        continue;
      }
      const stats = fs.statSync(filepath);
      const content = fs.readFileSync(filepath, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      const levels = {};
      for (const line of lines) {
        const parsed = this._parseLine(line);
        if (parsed) {
          levels[parsed.level] = (levels[parsed.level] || 0) + 1;
        }
      }

      result[key] = { size: stats.size, lines: lines.length, levels };
    }

    return result;
  }

  /**
   * 解析单行日志文本为对象
   */
  _parseLine(line) {
    // 格式: [2025-01-01T00:00:00.000Z] [INFO] message key=value
    const match = line.match(/^\[([^\]]+)\]\s+\[(\w+)\]\s+(.*)$/);
    if (!match) return null;

    const [, timestamp, level, rest] = match;
    return { timestamp, level, message: rest, meta: {} };
  }
}

const logQuery = new LogQuery();

// ============================================================
// 8. HTTP 服务 —— 日志 API
// ============================================================

// 模拟的业务数据
let requestCount = 0;

// 辅助函数：解析请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
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

// 辅助函数：发送 JSON 响应
function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

// GET /api/logs — 查询日志
function handleQueryLogs(req, res, parsedUrl) {
  const { level, category, search, file, limit, offset } =
    parsedUrl.query || {};
  const result = logQuery.query({
    level,
    category,
    search,
    file,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  apiLogger.info("查询日志", {
    level,
    category,
    search,
    resultCount: result.total,
  });
  send(res, 200, { success: true, data: result });
}

// GET /api/logs/stats — 日志统计
function handleLogStats(req, res) {
  const stats = logQuery.stats();
  apiLogger.info("查询日志统计");
  send(res, 200, { success: true, data: stats });
}

// POST /api/logs — 手动写入日志
async function handleWriteLog(req, res) {
  const body = await parseBody(req);
  const { level = "INFO", message, meta } = body;

  if (!message) {
    return send(res, 400, { success: false, error: "message 字段必填" });
  }

  const validLevels = Object.keys(LOG_LEVELS);
  if (!validLevels.includes(level.toUpperCase())) {
    return send(res, 400, {
      success: false,
      error: `无效的日志级别，可选值: ${validLevels.join(", ")}`,
    });
  }

  logger._log(level.toUpperCase(), message, meta);
  send(res, 201, { success: true, message: "日志已写入" });
}

// DELETE /api/logs — 清空日志文件
function handleClearLogs(req, res) {
  const { file } = url.parse(req.url, true).query || {};
  const targets =
    file === "error"
      ? [path.join(LOG_DIR, "error.log")]
      : file === "app"
        ? [path.join(LOG_DIR, "app.log")]
        : [path.join(LOG_DIR, "app.log"), path.join(LOG_DIR, "error.log")];

  for (const filepath of targets) {
    if (fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, "", "utf-8");
    }
  }

  apiLogger.warn("清空日志文件", {
    files: targets.map((p) => path.basename(p)),
  });
  send(res, 200, { success: true, message: "日志已清空" });
}

// GET /api/demo — 演示：生成各种级别的日志
function handleDemo(req, res) {
  requestCount++;

  logger.debug("调试信息：请求计数", { requestCount });
  logger.info("信息日志：演示接口被调用", { time: new Date().toISOString() });
  logger.warn("警告日志：这是一条警告", { requestCount });
  logger.error("错误日志：模拟一个错误", {
    code: "DEMO_ERROR",
    stack: "at demo.js:42",
  });
  logger.fatal("致命日志：严重错误", { exitCode: 1 });

  accessLogger.info("访问日志记录", { path: "/api/demo", method: "GET" });
  apiLogger.info("API 调用日志", { endpoint: "demo", duration: "12ms" });

  send(res, 200, {
    success: true,
    message: "已生成各级别日志，请查看控制台输出或调用 /api/logs 查看",
    generated: {
      levels: ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
      categories: ["default", "access", "api"],
    },
  });
}

// 请求处理主函数
async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // 记录访问日志
  const startTime = Date.now();
  accessLogger.info("收到请求", { method, path: pathname });

  try {
    // GET /api/logs
    if (method === "GET" && pathname === "/api/logs") {
      return handleQueryLogs(req, res, parsedUrl);
    }

    // GET /api/logs/stats
    if (method === "GET" && pathname === "/api/logs/stats") {
      return handleLogStats(req, res);
    }

    // POST /api/logs
    if (method === "POST" && pathname === "/api/logs") {
      return await handleWriteLog(req, res);
    }

    // DELETE /api/logs
    if (method === "DELETE" && pathname === "/api/logs") {
      return handleClearLogs(req, res);
    }

    // GET /api/demo
    if (method === "GET" && pathname === "/api/demo") {
      return handleDemo(req, res);
    }

    // 404
    send(res, 404, { success: false, error: "路由不存在" });
  } catch (err) {
    logger.error("请求处理失败", { error: err.message, stack: err.stack });
    send(res, 500, { success: false, error: "内部服务器错误" });
  } finally {
    const duration = Date.now() - startTime;
    accessLogger.info("请求完成", {
      method,
      path: pathname,
      duration: `${duration}ms`,
    });
  }
}

// ============================================================
// 9. 启动服务
// ============================================================
const server = http.createServer(handler);

server.listen(PORT, () => {
  logger.info("日志记录系统已启动", { port: PORT });

  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║           日志记录系统 - Logging System                   ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║   服务地址: http://localhost:${PORT}                        ║
  ║                                                          ║
  ║   功能特性:                                               ║
  ║     • 5 个日志级别 (DEBUG/INFO/WARN/ERROR/FATAL)          ║
  ║     • 多传输器 (控制台 + 文件)                             ║
  ║     • 日志文件自动轮转 (5MB/文件, 最多5个)                 ║
  ║     • 子日志记录器 (按模块分类)                            ║
  ║     • 错误日志单独记录到 error.log                        ║
  ║     • HTTP API 查询与管理日志                             ║
  ║                                                          ║
  ║   API 端点:                                               ║
  ║     GET    /api/logs          查询日志                     ║
  ║            ?level=ERROR       按级别过滤                   ║
  ║            ?category=access   按分类过滤                   ║
  ║            ?search=keyword    关键词搜索                   ║
  ║            ?file=error        查询错误日志                 ║
  ║            ?limit=20&offset=0 分页                        ║
  ║                                                          ║
  ║     GET    /api/logs/stats    日志统计信息                 ║
  ║     POST   /api/logs          写入日志                     ║
  ║            { "level":"INFO", "message":"hello" }          ║
  ║     DELETE /api/logs          清空日志 (?file=app|error)   ║
  ║     GET    /api/demo          演示生成各级别日志           ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

// 捕获未处理的异常和 Promise 拒绝
process.on("uncaughtException", (err) => {
  logger.fatal("未捕获的异常", { error: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  logger.fatal("未处理的 Promise 拒绝", { reason: String(reason) });
});
