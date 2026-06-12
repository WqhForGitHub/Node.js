const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// MIME 类型映射表
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

// 默认配置
const DEFAULT_CONFIG = {
  port: 3000,
  host: "127.0.0.1",
  root: "./public",
  indexFiles: ["index.html", "index.htm"],
  cacheMaxAge: 3600, // 缓存时间（秒）
  showDirectoryListing: true,
};

/**
 * 解析命令行参数
 * 用法: node server.js [--port 8080] [--host 0.0.0.0] [--root ./dist]
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
      case "-p":
        config.port = parseInt(args[++i], 10) || DEFAULT_CONFIG.port;
        break;
      case "--host":
      case "-h":
        config.host = args[++i] || DEFAULT_CONFIG.host;
        break;
      case "--root":
      case "-r":
        config.root = args[++i] || DEFAULT_CONFIG.root;
        break;
      case "--no-cache":
        config.cacheMaxAge = 0;
        break;
      case "--no-listing":
        config.showDirectoryListing = false;
        break;
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
HTTP 静态服务器 - 使用说明

用法: node server.js [选项]

选项:
  -p, --port <端号>       监听端口 (默认: 3000)
  -h, --host <地址>       监听地址 (默认: 127.0.0.1)
  -r, --root <目录>       静态文件根目录 (默认: ./public)
      --no-cache          禁用缓存
      --no-listing        禁用目录列表
      --help              显示帮助信息

示例:
  node server.js
  node server.js --port 8080 --host 0.0.0.0
  node server.js --root ./dist --no-cache
  `);
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

/**
 * 格式化日期
 */
function formatDate(date) {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 生成目录列表 HTML
 */
function generateDirectoryListing(dirPath, urlPath) {
  const items = fs.readdirSync(dirPath);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>目录列表: ${urlPath}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5; color: #333; padding: 20px;
    }
    h1 { font-size: 1.5em; margin-bottom: 16px; color: #1a1a1a; }
    .breadcrumb { margin-bottom: 16px; color: #666; font-size: 0.9em; }
    .breadcrumb a { color: #0066cc; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #fafafa; text-align: left; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #eee; font-size: 0.85em; text-transform: uppercase; color: #888; }
    td { padding: 10px 16px; border-bottom: 1px solid #f0f0f0; }
    tr:hover { background: #f8f9ff; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .icon { display: inline-block; width: 20px; text-align: center; margin-right: 8px; }
    .size { color: #888; font-size: 0.9em; }
    .date { color: #888; font-size: 0.9em; }
    .empty { text-align: center; padding: 40px; color: #999; }
  </style>
</head>
<body>
  <h1>📁 目录列表</h1>
  <div class="breadcrumb">路径: `;

  // 生成面包屑导航
  const parts = urlPath.split("/").filter(Boolean);
  html += `<a href="/">根目录</a>`;
  let breadcrumbPath = "";
  for (const part of parts) {
    breadcrumbPath += "/" + part;
    html += ` / <a href="${breadcrumbPath}">${part}</a>`;
  }

  html += `</div>
  <table>
    <thead>
      <tr><th>名称</th><th>大小</th><th>修改时间</th></tr>
    </thead>
    <tbody>`;

  // 父目录链接
  if (urlPath !== "/") {
    const parentPath = path.dirname(urlPath) || "/";
    html += `<tr>
      <td><span class="icon">📂</span><a href="${parentPath}">..</a></td>
      <td class="size">-</td>
      <td class="date">-</td>
    </tr>`;
  }

  // 分离目录和文件，分别排序
  const dirs = [];
  const files = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        dirs.push({ name: item, stat });
      } else {
        files.push({ name: item, stat });
      }
    } catch (err) {
      // 跳过无法访问的文件
    }
  }

  // 目录排在前面
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    const link = path.join(urlPath, dir.name).replace(/\\/g, "/");
    html += `<tr>
      <td><span class="icon">📂</span><a href="${link}/">${dir.name}/</a></td>
      <td class="size">-</td>
      <td class="date">${formatDate(dir.stat.mtime)}</td>
    </tr>`;
  }

  for (const file of files) {
    const link = path.join(urlPath, file.name).replace(/\\/g, "/");
    const ext = path.extname(file.name).toLowerCase();
    const icon = getImageIcon(ext) || "📄";
    html += `<tr>
      <td><span class="icon">${icon}</span><a href="${link}">${file.name}</a></td>
      <td class="size">${formatSize(file.stat.size)}</td>
      <td class="date">${formatDate(file.stat.mtime)}</td>
    </tr>`;
  }

  if (dirs.length === 0 && files.length === 0) {
    html += `<tr><td colspan="3" class="empty">此目录为空</td></tr>`;
  }

  html += `
    </tbody>
  </table>
</body>
</html>`;

  return html;
}

/**
 * 根据扩展名获取文件图标
 */
function getImageIcon(ext) {
  const iconMap = {
    ".html": "🌐",
    ".htm": "🌐",
    ".css": "🎨",
    ".js": "⚡",
    ".json": "📋",
    ".png": "🖼️",
    ".jpg": "🖼️",
    ".jpeg": "🖼️",
    ".gif": "🖼️",
    ".svg": "🖼️",
    ".mp3": "🎵",
    ".mp4": "🎬",
    ".pdf": "📕",
    ".zip": "📦",
    ".md": "📝",
    ".txt": "📃",
  };
  return iconMap[ext] || null;
}

/**
 * 发送错误响应
 */
function sendError(res, statusCode, message) {
  const statusText = {
    400: "Bad Request",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
  };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${statusCode} ${statusText[statusCode] || "Error"}</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f5f5f5; margin: 0; }
    .error-card { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .error-code { font-size: 4em; font-weight: bold; color: #e74c3c; }
    .error-msg { font-size: 1.2em; color: #666; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-code">${statusCode}</div>
    <div class="error-msg">${message || statusText[statusCode] || "Unknown Error"}</div>
  </div>
</body>
</html>`;

  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

/**
 * 处理请求
 */
function handleRequest(rootDir, config) {
  return (req, res) => {
    // 仅支持 GET 和 HEAD
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendError(res, 405, "仅支持 GET 和 HEAD 请求");
      return;
    }

    // 解析 URL，防止路径遍历攻击
    const parsedUrl = url.parse(req.url);
    const decodedPath = decodeURIComponent(parsedUrl.pathname);

    // 安全检查：防止路径遍历
    const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(rootDir, safePath);

    // 确保文件路径在根目录内
    if (!filePath.startsWith(path.resolve(rootDir))) {
      sendError(res, 403, "禁止访问");
      return;
    }

    // 检查文件/目录是否存在
    fs.stat(filePath, (err, stat) => {
      if (err) {
        if (err.code === "ENOENT") {
          sendError(res, 404, "文件未找到");
        } else if (err.code === "EACCES") {
          sendError(res, 403, "禁止访问");
        } else {
          sendError(res, 500, "服务器内部错误");
        }
        return;
      }

      // 如果是目录
      if (stat.isDirectory()) {
        // 尝试查找默认首页
        for (const indexFile of config.indexFiles) {
          const indexPath = path.join(filePath, indexFile);
          if (fs.existsSync(indexPath)) {
            serveFile(res, indexPath, config, req.method === "HEAD");
            return;
          }
        }

        // 如果 URL 不以 / 结尾，重定向
        if (!decodedPath.endsWith("/")) {
          res.writeHead(302, { Location: decodedPath + "/" });
          res.end();
          return;
        }

        // 显示目录列表
        if (config.showDirectoryListing) {
          try {
            const html = generateDirectoryListing(filePath, decodedPath);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(req.method === "HEAD" ? "" : html);
          } catch (listErr) {
            sendError(res, 500, "无法生成目录列表");
          }
        } else {
          sendError(res, 403, "目录列表已禁用");
        }
        return;
      }

      // 如果是文件，直接提供
      serveFile(res, filePath, config, req.method === "HEAD");
    });
  };
}

/**
 * 提供文件服务（支持流式传输和缓存）
 */
function serveFile(res, filePath, config, isHead) {
  const mimeType = getMimeType(filePath);

  fs.stat(filePath, (err, stat) => {
    if (err) {
      sendError(res, 500, "无法读取文件");
      return;
    }

    // 设置响应头
    const headers = {
      "Content-Type": mimeType,
      "Content-Length": stat.size,
      "Last-Modified": stat.mtime.toUTCString(),
      "Accept-Ranges": "bytes",
    };

    // 缓存控制
    if (config.cacheMaxAge > 0) {
      headers["Cache-Control"] = `public, max-age=${config.cacheMaxAge}`;
    } else {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    }

    // 如果是 HEAD 请求，只返回头信息
    if (isHead) {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    // 处理 Range 请求（断点续传）
    // 注意：这里简化处理，大文件可使用 fs.createReadStream 的 start/end 选项

    // 流式传输文件
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, headers);

    stream.on("error", () => {
      sendError(res, 500, "文件读取错误");
    });

    stream.pipe(res);
  });
}

/**
 * 启动服务器
 */
function start() {
  const config = parseArgs();
  const rootDir = path.resolve(config.root);

  // 检查根目录是否存在
  if (!fs.existsSync(rootDir)) {
    console.log(`⚠️  静态文件目录不存在: ${rootDir}`);
    console.log(`正在创建目录: ${rootDir}`);
    fs.mkdirSync(rootDir, { recursive: true });
  }

  const server = http.createServer(handleRequest(rootDir, config));

  server.listen(config.port, config.host, () => {
    console.log(`
╔══════════════════════════════════════════╗
║       HTTP 静态服务器已启动              ║
╠══════════════════════════════════════════╣
║  地址:     http://${config.host}:${config.port}           ║
║  根目录:   ${rootDir.padEnd(28)}║
║  缓存:     ${config.cacheMaxAge > 0 ? (config.cacheMaxAge + "s").padEnd(28) : "已禁用".padEnd(28)}║
║  目录列表: ${String(config.showDirectoryListing).padEnd(28)}║
╚══════════════════════════════════════════╝
    `);
  });

  // 优雅关闭
  process.on("SIGINT", () => {
    console.log("\n正在关闭服务器...");
    server.close(() => {
      console.log("服务器已关闭");
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    server.close(() => {
      console.log("服务器已关闭");
      process.exit(0);
    });
  });

  return server;
}

// 启动
start();
