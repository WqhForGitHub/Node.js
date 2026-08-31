const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');

const PORT = 3000;
const FILES_DIR = path.join(__dirname, 'files');
const MAX_SPEED = 0; // 限速（字节/秒），0 = 不限速

// ============================================================
// 1. 确保文件目录存在 & 创建示例文件
// ============================================================
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

/** 生成示例文件供下载测试 */
function createSampleFiles() {
  const samples = [
    {
      name: '欢迎.txt',
      content:
        '欢迎使用文件下载服务！\n\n这是一个纯 Node.js 实现的文件下载服务 Demo。\n支持：断点续传、分块下载、压缩传输、打包下载等功能。',
    },
    {
      name: 'readme.md',
      content:
        '# 文件下载服务\n\n## 功能列表\n\n- 文件浏览与下载\n- 断点续传（HTTP Range）\n- Gzip/Brotli 压缩传输\n- 多文件打包下载（ZIP）\n- 下载限速\n- 下载统计\n- ETag 缓存控制\n',
    },
    {
      name: 'data.json',
      content: JSON.stringify(
        {
          service: '文件下载服务',
          version: '1.0.0',
          features: ['断点续传', '压缩传输', '打包下载', '下载限速', 'ETag 缓存', '下载统计'],
          author: 'Node.js Demo',
        },
        null,
        2
      ),
    },
    {
      name: 'config.ini',
      content:
        '[server]\nport = 3000\nhost = localhost\n\n[download]\nmax_speed = 0\nchunk_size = 65536\n\n[security]\nallow_directory_traversal = false\n',
    },
  ];

  for (const s of samples) {
    const fp = path.join(FILES_DIR, s.name);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, s.content, 'utf-8');
    }
  }

  // 生成一个稍大的测试文件（约 1MB）
  const bigFile = path.join(FILES_DIR, '测试大文件.log');
  if (!fs.existsSync(bigFile)) {
    const lines = [];
    for (let i = 0; i < 20000; i++) {
      lines.push(
        `[${new Date(Date.now() - (20000 - i) * 5000).toISOString()}] INFO  request_id=${String(i).padStart(5, '0')} method=GET path=/api/data status=${200 + (i % 3 === 0 ? 1 : 0)} duration=${Math.floor(Math.random() * 200)}ms`
      );
    }
    fs.writeFileSync(bigFile, lines.join('\n'), 'utf-8');
  }
}

createSampleFiles();

// ============================================================
// 2. 下载统计
// ============================================================
const STATS_FILE = path.join(__dirname, '.stats.json');

/** @type {Map<string, object>} fileStats: fileId -> stats */
let downloadStats = new Map();

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        downloadStats.set(key, value);
      }
    }
  } catch {
    downloadStats = new Map();
  }
}

function saveStats() {
  const obj = Object.fromEntries(downloadStats);
  fs.writeFileSync(STATS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}

loadStats();

/**
 * 记录一次下载
 * @param {string} filename - 文件名
 * @param {number} size - 文件大小
 * @param {boolean} completed - 是否完整下载
 */
function recordDownload(filename, size, completed) {
  const existing = downloadStats.get(filename);
  if (existing) {
    existing.count += 1;
    existing.totalBytes += size;
    existing.lastDownload = new Date().toISOString();
    if (completed) existing.completedCount += 1;
  } else {
    downloadStats.set(filename, {
      filename,
      count: 1,
      completedCount: completed ? 1 : 0,
      totalBytes: size,
      lastDownload: new Date().toISOString(),
    });
  }
  saveStats();
}

// ============================================================
// 3. 工具函数
// ============================================================

/** 发送 JSON 响应 */
function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

/** 发送 HTML 响应 */
function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

/** 获取文件的 MIME 类型 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    '.ini': 'text/plain',
    '.log': 'text/plain',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return types[ext] || 'application/octet-stream';
}

/** 根据 MIME 类型获取友好分类名 */
function getCategory(mimeType) {
  if (mimeType.startsWith('image/')) return '图片';
  if (mimeType.startsWith('video/')) return '视频';
  if (mimeType.startsWith('audio/')) return '音频';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('text/')) return '文本';
  if (mimeType.includes('json') || mimeType.includes('xml')) return '数据';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z')
  )
    return '压缩包';
  if (mimeType.includes('word') || mimeType.includes('sheet') || mimeType.includes('presentation'))
    return '办公文档';
  return '其他';
}

/** 计算文件的 ETag */
function computeETag(stat, filePath) {
  return `"${stat.size}-${stat.mtimeMs.toFixed(0)}-${Buffer.from(filePath).toString('base64').slice(0, 12)}"`;
}

/** 安全拼接路径（防止目录穿越） */
function safePath(base, relative) {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base))) {
    return null;
  }
  return resolved;
}

/** 获取目录下的文件列表（支持子目录） */
function listDirectory(dir, baseDir = dir) {
  const items = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // 隐藏文件跳过
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        type: 'directory',
        children: listDirectory(fullPath, baseDir),
      });
    } else {
      const stat = fs.statSync(fullPath);
      const mimeType = getMimeType(fullPath);
      items.push({
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        type: 'file',
        size: stat.size,
        sizeFormatted: formatSize(stat.size),
        mimeType,
        category: getCategory(mimeType),
        modified: stat.mtime.toISOString(),
        etag: computeETag(stat, relativePath),
      });
    }
  }

  // 目录在前，文件在后；各自按名称排序
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

/** 将嵌套文件列表扁平化 */
function flattenFiles(items, prefix = '') {
  const result = [];
  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.type === 'file') {
      result.push({ ...item, path: itemPath });
    } else if (item.type === 'directory') {
      result.push(...flattenFiles(item.children || [], itemPath));
    }
  }
  return result;
}

// ============================================================
// 4. 限速流
// ============================================================

/**
 * 创建限速可读流
 * @param {string} filePath - 文件路径
 * @param {object} [options] - 读取选项
 * @param {number} [bytesPerSec] - 每秒字节数，0=不限速
 * @returns {fs.ReadStream}
 */
function createThrottledStream(filePath, options = {}, bytesPerSec = 0) {
  const stream = fs.createReadStream(filePath, options);
  if (!bytesPerSec || bytesPerSec <= 0) return stream;

  const chunkSize = Math.min(bytesPerSec, 65536);
  let lastTime = Date.now();
  let sentInPeriod = 0;

  stream.on('data', (chunk) => {
    sentInPeriod += chunk.length;
    if (sentInPeriod >= bytesPerSec) {
      const elapsed = Date.now() - lastTime;
      const waitTime = Math.max(0, 1000 - elapsed);
      if (waitTime > 0) {
        stream.pause();
        setTimeout(() => {
          lastTime = Date.now();
          sentInPeriod = 0;
          stream.resume();
        }, waitTime);
      } else {
        lastTime = Date.now();
        sentInPeriod = 0;
      }
    }
  });

  return stream;
}

// ============================================================
// 5. 简易 ZIP 打包（不依赖外部库）
// ============================================================

/**
 * 将多个文件打包为 ZIP 格式
 * ZIP 文件格式参考: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 * @param {Array<{name: string, data: Buffer}>} files
 * @returns {Buffer}
 */
function createZipBuffer(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf-8');
    const data = file.data;
    const crc = crc32(data);

    // Local file header
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0); // Signature
    local.writeUInt16LE(20, 4); // Version needed
    local.writeUInt16LE(0, 6); // Flags
    local.writeUInt16LE(0, 8); // Compression: stored (no compression)
    local.writeUInt16LE(0, 10); // Mod time
    local.writeUInt16LE(0, 12); // Mod date
    local.writeUInt32LE(crc, 14); // CRC-32
    local.writeUInt32LE(data.length, 18); // Compressed size
    local.writeUInt32LE(data.length, 22); // Uncompressed size
    local.writeUInt16LE(nameBytes.length, 26); // Filename length
    local.writeUInt16LE(0, 28); // Extra field length
    nameBytes.copy(local, 30);

    localHeaders.push(local);
    localHeaders.push(data);

    // Central directory header
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); // Signature
    central.writeUInt16LE(20, 4); // Version made by
    central.writeUInt16LE(20, 6); // Version needed
    central.writeUInt16LE(0, 8); // Flags
    central.writeUInt16LE(0, 10); // Compression
    central.writeUInt16LE(0, 12); // Mod time
    central.writeUInt16LE(0, 14); // Mod date
    central.writeUInt32LE(crc, 16); // CRC-32
    central.writeUInt32LE(data.length, 20); // Compressed size
    central.writeUInt32LE(data.length, 24); // Uncompressed size
    central.writeUInt16LE(nameBytes.length, 28); // Filename length
    central.writeUInt16LE(0, 30); // Extra field length
    central.writeUInt16LE(0, 32); // Comment length
    central.writeUInt16LE(0, 34); // Disk number start
    central.writeUInt16LE(0, 36); // Internal attributes
    central.writeUInt32LE(0, 38); // External attributes
    central.writeUInt32LE(offset, 42); // Offset of local header
    nameBytes.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + data.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of centralHeaders) centralSize += c.length;

  // End of central directory
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // Signature
  end.writeUInt16LE(0, 4); // Disk number
  end.writeUInt16LE(0, 6); // Disk with central dir
  end.writeUInt16LE(files.length, 8); // Entries on disk
  end.writeUInt16LE(files.length, 10); // Total entries
  end.writeUInt32LE(centralSize, 12); // Central dir size
  end.writeUInt32LE(centralOffset, 16); // Offset of central dir
  end.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, end]);
}

/**
 * CRC-32 计算
 * @param {Buffer} buf
 * @returns {number}
 */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ============================================================
// 6. 路由处理器
// ============================================================

/** GET / — 下载页面 */
function handleIndex(req, res) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件下载服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fa; color: #333; min-height: 100vh; }
    .container { max-width: 960px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; margin: 20px 0; font-size: 28px; color: #2c3e50; }
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-item { background: #fff; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat-value { font-size: 24px; font-weight: 700; color: #2c3e50; }
    .stat-label { font-size: 12px; color: #95a5a6; margin-top: 4px; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .toolbar input, .toolbar select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
    .toolbar input:focus, .toolbar select:focus { outline: none; border-color: #3498db; }
    .file-tree { list-style: none; }
    .file-tree ul { list-style: none; padding-left: 20px; }
    .tree-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #ecf0f1; border-radius: 8px; margin-bottom: 6px; transition: background .15s; }
    .tree-item:hover { background: #f8f9fa; }
    .tree-item.selected { background: #eaf4fd; border-color: #3498db; }
    .tree-item-info { display: flex; align-items: center; flex: 1; min-width: 0; }
    .tree-item-icon { margin-right: 10px; font-size: 18px; }
    .tree-item-name { font-weight: 500; color: #2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    .tree-item-name.folder { color: #f39c12; }
    .tree-item-meta { font-size: 12px; color: #95a5a6; margin-left: 12px; white-space: nowrap; }
    .tree-item-actions { display: flex; gap: 6px; }
    .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all .15s; text-decoration: none; display: inline-block; }
    .btn-primary { background: #3498db; color: #fff; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: #fff; }
    .btn-success:hover { background: #219a52; }
    .btn-warning { background: #f39c12; color: #fff; }
    .btn-warning:hover { background: #d68910; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .checkbox { width: 16px; height: 16px; margin-right: 8px; cursor: pointer; }
    .batch-bar { display: none; align-items: center; justify-content: space-between; padding: 12px 16px; background: #eaf4fd; border-radius: 8px; margin-bottom: 12px; }
    .batch-bar.show { display: flex; }
    .preview-panel { display: none; margin-top: 16px; padding: 16px; background: #fafbfc; border-radius: 8px; border: 1px solid #ecf0f1; }
    .preview-panel.show { display: block; }
    .preview-content { max-height: 300px; overflow: auto; white-space: pre-wrap; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 13px; line-height: 1.5; }
    .preview-image { max-width: 100%; max-height: 300px; border-radius: 4px; }
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; z-index: 999; opacity: 0; transition: opacity .3s; }
    .toast.show { opacity: 1; }
    .toast.success { background: #27ae60; }
    .toast.error { background: #e74c3c; }
    .empty { text-align: center; color: #bdc3c7; padding: 40px 0; font-size: 15px; }
    .download-item { padding: 8px 12px; border-bottom: 1px solid #ecf0f1; display: flex; justify-content: space-between; align-items: center; }
    .download-item:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>文件下载服务</h1>

    <div class="stats" id="stats"></div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="searchInput" placeholder="搜索文件名...">
        <select id="categoryFilter">
          <option value="">全部分类</option>
          <option value="图片">图片</option>
          <option value="视频">视频</option>
          <option value="音频">音频</option>
          <option value="PDF">PDF</option>
          <option value="文本">文本</option>
          <option value="数据">数据</option>
          <option value="压缩包">压缩包</option>
          <option value="办公文档">办公文档</option>
        </select>
        <select id="sortSelect">
          <option value="name">按名称</option>
          <option value="size">按大小</option>
          <option value="modified">按修改时间</option>
        </select>
      </div>
      <div class="batch-bar" id="batchBar">
        <span id="batchCount">已选择 0 个文件</span>
        <div>
          <button class="btn btn-primary btn-sm" onclick="batchDownload()">打包下载选中</button>
          <button class="btn btn-sm" style="background:#95a5a6;color:#fff" onclick="clearSelection()">取消选择</button>
        </div>
      </div>
      <ul class="file-tree" id="fileTree"></ul>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px;color:#2c3e50">下载记录</h3>
      <div id="downloadLog"></div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let allFiles = [];
    let selectedPaths = new Set();

    // 加载文件列表
    async function loadFiles() {
      const search = document.getElementById('searchInput').value;
      const category = document.getElementById('categoryFilter').value;
      const sort = document.getElementById('sortSelect').value;
      const params = new URLSearchParams({ search, category, sort });
      const res = await fetch('/api/files?' + params);
      const data = await res.json();
      allFiles = data.data;
      renderTree();
    }

    // 渲染文件树
    function renderTree() {
      const tree = document.getElementById('fileTree');
      if (!allFiles.length) {
        tree.innerHTML = '<div class="empty">暂无可下载文件</div>';
        return;
      }
      tree.innerHTML = renderItems(allFiles);
    }

    function renderItems(items) {
      return items.map(item => {
        if (item.type === 'directory') {
          return '<li>' +
            '<div class="tree-item" onclick="toggleFolder(this)">' +
              '<div class="tree-item-info">' +
                '<span class="tree-item-icon">&#128193;</span>' +
                '<span class="tree-item-name folder">' + item.name + '</span>' +
              '</div>' +
            '</div>' +
            '<ul style="display:none">' + renderItems(item.children || []) + '</ul>' +
          '</li>';
        }
        const checked = selectedPaths.has(item.path) ? 'checked' : '';
        const isImage = item.mimeType && item.mimeType.startsWith('image/');
        const icon = isImage ? '&#128444;' :
                     item.category === '视频' ? '&#127916;' :
                     item.category === '音频' ? '&#127925;' :
                     item.category === 'PDF' ? '&#128196;' :
                     item.category === '压缩包' ? '&#128230;' : '&#128196;';
        return '<li>' +
          '<div class="tree-item' + (selectedPaths.has(item.path) ? ' selected' : '') + '">' +
            '<div class="tree-item-info">' +
              '<input type="checkbox" class="checkbox" data-path="' + item.path + '" ' + checked + ' onchange="toggleSelect(this)">' +
              '<span class="tree-item-icon">' + icon + '</span>' +
              '<span class="tree-item-name" onclick="previewFile(\\'' + item.path + '\\')">' + item.name + '</span>' +
              '<span class="tree-item-meta">' + item.category + ' · ' + item.sizeFormatted + ' · ' + new Date(item.modified).toLocaleDateString() + '</span>' +
            '</div>' +
            '<div class="tree-item-actions">' +
              '<a href="/api/files/' + encodeURIComponent(item.path) + '/download" class="btn btn-success btn-sm" download>下载</a>' +
            '</div>' +
          '</div>' +
        '</li>';
      }).join('');
    }

    // 展开/折叠目录
    function toggleFolder(el) {
      const ul = el.nextElementSibling;
      if (ul) {
        const visible = ul.style.display !== 'none';
        ul.style.display = visible ? 'none' : 'block';
        el.querySelector('.tree-item-icon').textContent = visible ? '📁' : '📂';
      }
    }

    // 选择/取消选择文件
    function toggleSelect(checkbox) {
      const p = checkbox.dataset.path;
      if (checkbox.checked) {
        selectedPaths.add(p);
      } else {
        selectedPaths.delete(p);
      }
      updateBatchBar();
      renderTree();
    }

    function clearSelection() {
      selectedPaths.clear();
      updateBatchBar();
      renderTree();
    }

    function updateBatchBar() {
      const bar = document.getElementById('batchBar');
      const count = document.getElementById('batchCount');
      if (selectedPaths.size > 0) {
        bar.classList.add('show');
        count.textContent = '已选择 ' + selectedPaths.size + ' 个文件';
      } else {
        bar.classList.remove('show');
      }
    }

    // 打包下载
    async function batchDownload() {
      if (!selectedPaths.size) return;
      const paths = Array.from(selectedPaths);
      const res = await fetch('/api/download/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: paths })
      });

      if (!res.ok) {
        const err = await res.json();
        showToast('打包失败: ' + err.error, 'error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'download-' + Date.now() + '.zip';
      a.click();
      URL.revokeObjectURL(url);
      showToast('打包下载成功', 'success');
      loadStats();
    }

    // 预览文件
    async function previewFile(filePath) {
      const res = await fetch('/api/files/' + encodeURIComponent(filePath) + '/preview');
      if (!res.ok) {
        showToast('无法预览此文件', 'error');
        return;
      }
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        showToast('图片预览已打开（新窗口）', 'success');
        window.open(url, '_blank');
      } else {
        const text = await res.text();
        const win = window.open('', '_blank');
        win.document.write('<pre style="padding:20px;font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;">' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>');
        win.document.title = '预览 - ' + filePath.split('/').pop();
      }
    }

    // 加载统计
    async function loadStats() {
      const res = await fetch('/api/stats');
      const data = await res.json();
      const s = data.data;
      document.getElementById('stats').innerHTML =
        '<div class="stat-item"><div class="stat-value">' + s.totalFiles + '</div><div class="stat-label">文件总数</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + s.totalSizeFormatted + '</div><div class="stat-label">总大小</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + s.totalDownloads + '</div><div class="stat-label">下载次数</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + s.totalBytesSentFormatted + '</div><div class="stat-label">已传输</div></div>';

      // 下载记录
      const log = document.getElementById('downloadLog');
      const records = Object.values(s.recentDownloads || {}).sort((a, b) => new Date(b.lastDownload) - new Date(a.lastDownload));
      if (!records.length) {
        log.innerHTML = '<div class="empty">暂无下载记录</div>';
      } else {
        log.innerHTML = records.map(r =>
          '<div class="download-item">' +
            '<span>' + r.filename + '</span>' +
            '<span style="color:#95a5a6;font-size:12px">' + r.count + ' 次下载 · ' + formatSizeJS(r.totalBytes) + ' · ' + new Date(r.lastDownload).toLocaleString() + '</span>' +
          '</div>'
        ).join('');
      }
    }

    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast show ' + type;
      setTimeout(() => toast.className = 'toast', 2500);
    }

    function formatSizeJS(bytes) {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
    }

    // 事件绑定
    document.getElementById('searchInput').addEventListener('input', loadFiles);
    document.getElementById('categoryFilter').addEventListener('change', loadFiles);
    document.getElementById('sortSelect').addEventListener('change', loadFiles);

    // 初始化
    loadFiles();
    loadStats();
  </script>
</body>
</html>`;
  sendHTML(res, html);
}

/** GET /api/files — 获取文件列表（扁平化，支持搜索/过滤/排序） */
function handleListFiles(req, res, parsedUrl) {
  const { search, category, sort } = parsedUrl.query || {};

  const items = listDirectory(FILES_DIR);
  let flat = flattenFiles(items);

  // 搜索
  if (search) {
    const kw = search.toLowerCase();
    flat = flat.filter((f) => f.name.toLowerCase().includes(kw));
  }

  // 分类过滤
  if (category) {
    flat = flat.filter((f) => f.category === category);
  }

  // 排序
  const sortField = sort || 'name';
  flat.sort((a, b) => {
    if (sortField === 'size') return a.size - b.size;
    if (sortField === 'modified') return new Date(a.modified) - new Date(b.modified);
    return a.name.localeCompare(b.name);
  });

  send(res, 200, { success: true, count: flat.length, data: flat });
}

/** GET /api/files/:path/download — 下载文件（支持断点续传、压缩） */
function handleDownloadFile(req, res, filePath) {
  const fullPath = safePath(FILES_DIR, filePath);
  if (!fullPath) {
    return send(res, 403, { success: false, error: '禁止访问' });
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;
  const mimeType = getMimeType(fullPath);
  const etag = computeETag(stat, filePath);
  const lastModified = stat.mtime.toUTCString();

  // If-None-Match → 304
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    return res.end();
  }

  // If-Modified-Since → 304
  if (
    !req.headers['if-none-match'] &&
    req.headers['if-modified-since'] &&
    new Date(req.headers['if-modified-since']) >= stat.mtime
  ) {
    res.writeHead(304);
    return res.end();
  }

  // Range 请求 → 断点续传
  const rangeHeader = req.headers['range'];
  if (rangeHeader) {
    const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!rangeMatch) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`,
      });
      return res.end();
    }

    const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    // 边界检查
    if (start >= fileSize || end >= fileSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`,
      });
      return res.end();
    }

    const contentLength = end - start + 1;
    const originalName = path.basename(filePath);

    res.writeHead(206, {
      'Content-Type': mimeType,
      'Content-Length': contentLength,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
      'Accept-Ranges': 'bytes',
      ETag: etag,
      'Last-Modified': lastModified,
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = createThrottledStream(fullPath, { start, end }, MAX_SPEED);
    stream.pipe(res);

    // 统计
    recordDownload(originalName, contentLength, start === 0 && end === fileSize - 1);
    return;
  }

  // 普通下载
  const originalName = path.basename(filePath);
  const headers = {
    'Content-Type': mimeType,
    'Content-Length': fileSize,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    'Accept-Ranges': 'bytes',
    ETag: etag,
    'Last-Modified': lastModified,
    'Cache-Control': 'public, max-age=86400',
  };

  // 压缩传输（仅对文本类文件，且客户端支持）
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isCompressible =
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType === 'image/svg+xml';

  if (isCompressible && fileSize > 1024) {
    if (acceptEncoding.includes('br')) {
      headers['Content-Encoding'] = 'br';
      delete headers['Content-Length'];
      res.writeHead(200, headers);
      const stream = createThrottledStream(fullPath, {}, MAX_SPEED);
      stream.pipe(zlib.createBrotliCompress()).pipe(res);
      recordDownload(originalName, fileSize, true);
      return;
    }
    if (acceptEncoding.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      delete headers['Content-Length'];
      res.writeHead(200, headers);
      const stream = createThrottledStream(fullPath, {}, MAX_SPEED);
      stream.pipe(zlib.createGzip()).pipe(res);
      recordDownload(originalName, fileSize, true);
      return;
    }
  }

  res.writeHead(200, headers);
  const stream = createThrottledStream(fullPath, {}, MAX_SPEED);
  stream.pipe(res);
  recordDownload(originalName, fileSize, true);
}

/** GET /api/files/:path/preview — 预览文件 */
function handlePreviewFile(req, res, filePath) {
  const fullPath = safePath(FILES_DIR, filePath);
  if (!fullPath) {
    return send(res, 403, { success: false, error: '禁止访问' });
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  const stat = fs.statSync(fullPath);
  // 预览限制：文本类 1MB，图片 5MB，其他不支持
  const mimeType = getMimeType(fullPath);
  const isText =
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('javascript') ||
    mimeType === 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');

  if (isText && stat.size <= 1024 * 1024) {
    res.writeHead(200, {
      'Content-Type': mimeType + '; charset=utf-8',
      'Content-Length': stat.size,
    });
    fs.createReadStream(fullPath).pipe(res);
  } else if (isImage && stat.size <= 5 * 1024 * 1024) {
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stat.size,
    });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    send(res, 415, {
      success: false,
      error: '此文件不支持在线预览',
    });
  }
}

/** POST /api/download/zip — 多文件打包下载 */
function handleZipDownload(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      // 请求体过大
      req.destroy();
      send(res, 413, { success: false, error: '请求体过大' });
    }
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const files = parsed.files;
      if (!Array.isArray(files) || files.length === 0) {
        return send(res, 400, { success: false, error: '请选择要下载的文件' });
      }
      if (files.length > 100) {
        return send(res, 400, {
          success: false,
          error: '一次最多打包 100 个文件',
        });
      }

      const zipFiles = [];
      let totalSize = 0;
      const MAX_ZIP_SIZE = 200 * 1024 * 1024; // 200MB

      for (const fp of files) {
        const fullPath = safePath(FILES_DIR, fp);
        if (!fullPath) continue;
        if (!fs.existsSync(fullPath)) continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) continue;
        if (totalSize + stat.size > MAX_ZIP_SIZE) {
          return send(res, 400, {
            success: false,
            error: `打包总大小超过限制 (${formatSize(MAX_ZIP_SIZE)})`,
          });
        }
        totalSize += stat.size;
        zipFiles.push({
          name: path.basename(fp),
          data: fs.readFileSync(fullPath),
        });
      }

      if (!zipFiles.length) {
        return send(res, 400, { success: false, error: '没有可下载的文件' });
      }

      const zipBuffer = createZipBuffer(zipFiles);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('download-' + Date.now() + '.zip')}`,
      });
      res.end(zipBuffer);

      // 统计
      for (const f of zipFiles) {
        recordDownload(f.name, f.data.length, true);
      }
    } catch {
      send(res, 400, { success: false, error: '无效的请求体' });
    }
  });
}

/** GET /api/stats — 下载统计 */
function handleStats(req, res) {
  const items = listDirectory(FILES_DIR);
  const flat = flattenFiles(items);
  const totalSize = flat.reduce((sum, f) => sum + f.size, 0);
  const totalDownloads = Array.from(downloadStats.values()).reduce((sum, s) => sum + s.count, 0);
  const totalBytesSent = Array.from(downloadStats.values()).reduce(
    (sum, s) => sum + s.totalBytes,
    0
  );

  send(res, 200, {
    success: true,
    data: {
      totalFiles: flat.length,
      totalSize,
      totalSizeFormatted: formatSize(totalSize),
      totalDownloads,
      totalBytesSent,
      totalBytesSentFormatted: formatSize(totalBytesSent),
      recentDownloads: Object.fromEntries(downloadStats),
    },
  });
}

// ============================================================
// 7. HTTP 请求路由
// ============================================================
function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // GET / — 下载页面
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res);
    }

    // GET /api/files — 文件列表
    if (method === 'GET' && pathname === '/api/files') {
      return handleListFiles(req, res, parsedUrl);
    }

    // GET /api/stats — 下载统计
    if (method === 'GET' && pathname === '/api/stats') {
      return handleStats(req, res);
    }

    // POST /api/download/zip — 打包下载
    if (method === 'POST' && pathname === '/api/download/zip') {
      return handleZipDownload(req, res);
    }

    // /api/files/:path/download 和 /api/files/:path/preview
    const downloadMatch = pathname.match(/^\/api\/files\/(.+?)\/download$/);
    if (method === 'GET' && downloadMatch) {
      const filePath = decodeURIComponent(downloadMatch[1]);
      return handleDownloadFile(req, res, filePath);
    }

    const previewMatch = pathname.match(/^\/api\/files\/(.+?)\/preview$/);
    if (method === 'GET' && previewMatch) {
      const filePath = decodeURIComponent(previewMatch[1]);
      return handlePreviewFile(req, res, filePath);
    }

    send(res, 404, { success: false, error: '路由不存在' });
  } catch (err) {
    console.error('请求处理错误:', err);
    send(res, 500, { success: false, error: '内部服务器错误' });
  }
}

// ============================================================
// 8. 启动服务
// ============================================================
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║           文件下载服务 - File Download Service             ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║   服务地址: http://localhost:${PORT}                        ║
  ║                                                          ║
  ║   功能特性:                                               ║
  ║     • 纯 Node.js 实现，零外部依赖                          ║
  ║     • 断点续传（HTTP Range 请求）                          ║
  ║     • Gzip / Brotli 压缩传输                              ║
  ║     • 多文件打包下载（ZIP）                                 ║
  ║     • 下载限速控制                                        ║
  ║     • ETag 缓存 / 304 Not Modified                       ║
  ║     • 文件搜索 / 分类 / 排序                              ║
  ║     • 文本 & 图片在线预览                                  ║
  ║     • 下载统计记录                                        ║
  ║     • 路径安全防护（防目录穿越）                            ║
  ║                                                          ║
  ║   API 端点:                                               ║
  ║     GET  /                         下载页面（HTML）        ║
  ║     GET  /api/files                文件列表                ║
  ║         ?search=关键词             搜索文件名              ║
  ║         ?category=文本             按分类过滤              ║
  ║         ?sort=name                 按字段排序              ║
  ║     GET  /api/files/:path/download  下载文件               ║
  ║         支持 Range 请求断点续传                            ║
  ║     GET  /api/files/:path/preview   预览文件               ║
  ║     POST /api/download/zip         打包下载                ║
  ║         { "files": ["a.txt", "b.md"] }                    ║
  ║     GET  /api/stats                下载统计                ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n服务正在关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});
