const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// ============================================================
// 1. 确保上传目录存在
// ============================================================
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// 2. 文件元数据存储（内存 + 持久化）
// ============================================================
const META_FILE = path.join(UPLOAD_DIR, '.meta.json');

/** @type {Map<string, object>} */
let fileStore = new Map();

function loadMeta() {
  try {
    if (fs.existsSync(META_FILE)) {
      const data = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        fileStore.set(key, value);
      }
    }
  } catch {
    fileStore = new Map();
  }
}

function saveMeta() {
  const obj = Object.fromEntries(fileStore);
  fs.writeFileSync(META_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}

loadMeta();

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

/** 根据 MIME 类型获取友好分类名 */
function getCategory(mimeType) {
  if (mimeType.startsWith('image/')) return '图片';
  if (mimeType.startsWith('video/')) return '视频';
  if (mimeType.startsWith('audio/')) return '音频';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('text/')) return '文本';
  if (mimeType.includes('json')) return '数据';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip'))
    return '压缩包';
  if (mimeType.includes('sheet') || mimeType.includes('document')) return '办公文档';
  return '其他';
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
}

/** 生成文件存储名（避免冲突） */
function generateStorageName(originalName) {
  const ext = path.extname(originalName);
  const id = crypto.randomUUID().split('-')[0];
  return `${Date.now()}-${id}${ext}`;
}

/** 清理过期的临时文件 */
function cleanupTempFiles() {
  const tempDir = path.join(UPLOAD_DIR, '.temp');
  if (!fs.existsSync(tempDir)) return;
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  for (const file of files) {
    const filepath = path.join(tempDir, file);
    const stat = fs.statSync(filepath);
    if (now - stat.mtimeMs > 30 * 60 * 1000) {
      // 超过 30 分钟
      fs.unlinkSync(filepath);
    }
  }
}

setInterval(cleanupTempFiles, 5 * 60 * 1000); // 每 5 分钟清理一次

// ============================================================
// 4. Multipart Form-Data 解析器
// ============================================================

/**
 * 解析 multipart/form-data 请求
 * @param {http.IncomingMessage} req
 * @returns {Promise<{fields: object, files: Array<object>}>}
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!boundaryMatch) {
      return reject(new Error('无法解析 boundary，请确认 Content-Type 为 multipart/form-data'));
    }

    const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]);
    const endBoundary = boundary + '--';
    const fields = {};
    const files = [];

    let buffer = Buffer.alloc(0);
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_FILE_SIZE + 1024 * 1024) {
        // 额外 1MB 给表单字段
        reject(new Error(`文件总大小超过限制 (${formatSize(MAX_FILE_SIZE)})`));
        req.destroy();
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
    });

    req.on('end', () => {
      try {
        const result = parseMultipartBuffer(buffer, boundary, endBoundary);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

/**
 * 从 Buffer 中解析 multipart 数据
 */
function parseMultipartBuffer(buffer, boundary, endBoundary) {
  const fields = {};
  const files = [];

  // 按边界分割
  let start = buffer.indexOf(boundary);
  if (start === -1) return { fields, files };
  start += boundary.length;

  while (start < buffer.length) {
    // 跳过 \r\n
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) {
      start += 2;
    }

    // 查找头部结束位置（\r\n\r\n）
    const headerEnd = bufferIndexOf(buffer, Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(start, headerEnd).toString('utf-8');

    // 解析 Content-Disposition
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (!nameMatch) break;

    const fieldName = nameMatch[1];
    const bodyStart = headerEnd + 4; // 跳过 \r\n\r\n

    // 查找下一个边界
    let nextBoundary = bufferIndexOf(buffer, Buffer.from('\r\n' + boundary), bodyStart);
    if (nextBoundary === -1) {
      nextBoundary = bufferIndexOf(buffer, Buffer.from(endBoundary), bodyStart);
    }
    if (nextBoundary === -1) {
      nextBoundary = buffer.length;
    }

    const body = buffer.slice(bodyStart, nextBoundary);

    if (filenameMatch) {
      // 这是一个文件
      const filename = filenameMatch[1];
      const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

      files.push({
        field: fieldName,
        filename,
        mimeType,
        size: body.length,
        data: body,
      });
    } else {
      // 这是一个普通字段
      fields[fieldName] = body.toString('utf-8');
    }

    start = nextBoundary + boundary.length + 2; // 跳过 \r\n
  }

  return { fields, files };
}

/**
 * 在 Buffer 中查找子 Buffer
 */
function bufferIndexOf(buf, sub, offset = 0) {
  for (let i = offset; i <= buf.length - sub.length; i++) {
    let found = true;
    for (let j = 0; j < sub.length; j++) {
      if (buf[i + j] !== sub[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

// ============================================================
// 5. 文件存储操作
// ============================================================

/**
 * 保存上传的文件
 */
function saveFile(fileInfo, description) {
  const storageName = generateStorageName(fileInfo.filename);
  const filepath = path.join(UPLOAD_DIR, storageName);

  // 写入文件
  fs.writeFileSync(filepath, fileInfo.data);

  // 生成文件 ID
  const fileId = crypto.randomUUID();

  // 计算文件哈希
  const hash = crypto.createHash('sha256').update(fileInfo.data).digest('hex');

  // 检查是否有相同哈希的文件（去重提示）
  let duplicateOf = null;
  for (const [id, meta] of fileStore) {
    if (meta.hash === hash) {
      duplicateOf = id;
      break;
    }
  }

  // 保存元数据
  const meta = {
    id: fileId,
    originalName: fileInfo.filename,
    storageName,
    mimeType: fileInfo.mimeType,
    category: getCategory(fileInfo.mimeType),
    size: fileInfo.size,
    hash,
    description: description || '',
    duplicateOf,
    uploadedAt: new Date().toISOString(),
  };

  fileStore.set(fileId, meta);
  saveMeta();

  return meta;
}

/**
 * 获取文件信息
 */
function getFileInfo(fileId) {
  return fileStore.get(fileId) || null;
}

/**
 * 删除文件
 */
function deleteFile(fileId) {
  const meta = fileStore.get(fileId);
  if (!meta) return null;

  // 删除物理文件
  const filepath = path.join(UPLOAD_DIR, meta.storageName);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  // 删除元数据
  fileStore.delete(fileId);
  saveMeta();

  return meta;
}

/**
 * 列出所有文件
 */
function listFiles(options = {}) {
  let files = Array.from(fileStore.values());

  // 按分类过滤
  if (options.category) {
    files = files.filter((f) => f.category === options.category);
  }

  // 按类型过滤
  if (options.type) {
    const typePrefix = options.type;
    files = files.filter((f) => f.mimeType.startsWith(typePrefix));
  }

  // 关键词搜索
  if (options.search) {
    const keyword = options.search.toLowerCase();
    files = files.filter(
      (f) =>
        f.originalName.toLowerCase().includes(keyword) ||
        f.description.toLowerCase().includes(keyword)
    );
  }

  // 排序
  const sortBy = options.sort || 'uploadedAt';
  const sortOrder = options.order || 'desc';
  files.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return files;
}

/**
 * 获取存储统计信息
 */
function getStats() {
  const files = Array.from(fileStore.values());
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const categories = {};
  const types = {};

  for (const f of files) {
    categories[f.category] = (categories[f.category] || 0) + 1;
    const typeGroup = f.mimeType.split('/')[0];
    types[typeGroup] = (types[typeGroup] || 0) + f.size;
  }

  return {
    totalFiles: files.length,
    totalSize,
    totalSizeFormatted: formatSize(totalSize),
    categories,
    types,
    maxSize: MAX_FILE_SIZE,
    maxSizeFormatted: formatSize(MAX_FILE_SIZE),
  };
}

// ============================================================
// 6. 路由处理器
// ============================================================

/** GET / — 上传页面 */
function handleIndex(req, res) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文件上传服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fa; color: #333; min-height: 100vh; }
    .container { max-width: 960px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; margin: 20px 0; font-size: 28px; color: #2c3e50; }
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .upload-zone { border: 2px dashed #c0cfe0; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all .2s; }
    .upload-zone:hover, .upload-zone.dragover { border-color: #3498db; background: #eaf4fd; }
    .upload-zone p { margin: 8px 0; color: #7f8c8d; }
    .upload-zone .icon { font-size: 48px; color: #bdc3c7; }
    input[type="file"] { display: none; }
    .file-list { margin-top: 16px; }
    .file-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #ecf0f1; border-radius: 8px; margin-bottom: 8px; transition: background .15s; }
    .file-item:hover { background: #f8f9fa; }
    .file-info { flex: 1; min-width: 0; }
    .file-name { font-weight: 500; color: #2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-meta { font-size: 12px; color: #95a5a6; margin-top: 2px; }
    .file-actions { display: flex; gap: 8px; }
    .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all .15s; }
    .btn-primary { background: #3498db; color: #fff; }
    .btn-primary:hover { background: #2980b9; }
    .btn-danger { background: #e74c3c; color: #fff; }
    .btn-danger:hover { background: #c0392b; }
    .btn-success { background: #27ae60; color: #fff; }
    .btn-success:hover { background: #219a52; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .desc-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; margin-top: 12px; font-size: 14px; }
    .desc-input:focus { outline: none; border-color: #3498db; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-item { background: #fff; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat-value { font-size: 24px; font-weight: 700; color: #2c3e50; }
    .stat-label { font-size: 12px; color: #95a5a6; margin-top: 4px; }
    .progress { height: 4px; background: #ecf0f1; border-radius: 2px; margin-top: 8px; display: none; }
    .progress-bar { height: 100%; background: #3498db; border-radius: 2px; transition: width .2s; width: 0%; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .toolbar input, .toolbar select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
    .toolbar input:focus, .toolbar select:focus { outline: none; border-color: #3498db; }
    .empty { text-align: center; color: #bdc3c7; padding: 40px 0; font-size: 15px; }
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; z-index: 999; opacity: 0; transition: opacity .3s; }
    .toast.show { opacity: 1; }
    .toast.success { background: #27ae60; }
    .toast.error { background: #e74c3c; }
    .duplicate-badge { display: inline-block; background: #f39c12; color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>文件上传服务</h1>

    <div class="stats" id="stats"></div>

    <div class="card">
      <div class="upload-zone" id="uploadZone">
        <div class="icon">&#128193;</div>
        <p>拖拽文件到此处，或点击选择文件</p>
        <p style="font-size:12px">支持图片、视频、音频、PDF、文本、压缩包等，单次最大 ${formatSize(MAX_FILE_SIZE)}</p>
      </div>
      <input type="file" id="fileInput" multiple>
      <input type="text" class="desc-input" id="descInput" placeholder="添加文件描述（可选）">
      <div class="progress" id="progress"><div class="progress-bar" id="progressBar"></div></div>
    </div>

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
        </select>
        <select id="sortSelect">
          <option value="uploadedAt">按上传时间</option>
          <option value="originalName">按文件名</option>
          <option value="size">按文件大小</option>
        </select>
      </div>
      <div class="file-list" id="fileList"></div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const descInput = document.getElementById('descInput');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const fileListEl = document.getElementById('fileList');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortSelect = document.getElementById('sortSelect');

    // 点击上传
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

    // 拖拽上传
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      uploadFiles(e.dataTransfer.files);
    });

    // 上传文件
    async function uploadFiles(files) {
      if (!files.length) return;
      progress.style.display = 'block';
      progressBar.style.width = '0%';

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        if (descInput.value) formData.append('description', descInput.value);

        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload');

          await new Promise((resolve, reject) => {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = ((i + e.loaded / e.total) / files.length) * 100;
                progressBar.style.width = pct + '%';
              }
            };
            xhr.onload = () => {
              if (xhr.status < 400) resolve();
              else reject(JSON.parse(xhr.responseText));
            };
            xhr.onerror = () => reject(new Error('上传失败'));
            xhr.send(formData);
          });

          showToast('上传成功: ' + files[i].name, 'success');
        } catch (err) {
          showToast('上传失败: ' + (err.error || err.message || '未知错误'), 'error');
        }
      }

      progressBar.style.width = '100%';
      setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0%'; }, 800);
      descInput.value = '';
      fileInput.value = '';
      loadFiles();
      loadStats();
    }

    // 加载文件列表
    async function loadFiles() {
      const search = searchInput.value;
      const category = categoryFilter.value;
      const sort = sortSelect.value;
      const params = new URLSearchParams({ search, category, sort, order: 'desc' });
      const res = await fetch('/api/files?' + params);
      const data = await res.json();

      if (!data.data.length) {
        fileListEl.innerHTML = '<div class="empty">暂无文件，快来上传吧</div>';
        return;
      }

      fileListEl.innerHTML = data.data.map(f => {
        const isImage = f.mimeType.startsWith('image/');
        const thumb = isImage ? '<img src="/api/files/' + f.id + '/download" style="width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:12px">' : '';
        const dupBadge = f.duplicateOf ? '<span class="duplicate-badge">重复</span>' : '';
        return '<div class="file-item">' +
          '<div style="display:flex;align-items:center;min-width:0;flex:1">' +
            thumb +
            '<div class="file-info">' +
              '<div class="file-name" title="' + f.originalName + '">' + f.originalName + dupBadge + '</div>' +
              '<div class="file-meta">' + f.category + ' · ' + formatSize(f.size) + ' · ' + new Date(f.uploadedAt).toLocaleString() + (f.description ? ' · ' + f.description : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="file-actions">' +
            '<a href="/api/files/' + f.id + '/download" class="btn btn-success btn-sm" download>下载</a>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteFile(\\'' + f.id + '\\')">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // 删除文件
    async function deleteFile(id) {
      if (!confirm('确定要删除此文件吗？')) return;
      const res = await fetch('/api/files/' + id, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('删除成功', 'success');
        loadFiles();
        loadStats();
      } else {
        showToast('删除失败: ' + data.error, 'error');
      }
    }

    // 加载统计
    async function loadStats() {
      const res = await fetch('/api/stats');
      const data = await res.json();
      const s = data.data;
      document.getElementById('stats').innerHTML =
        '<div class="stat-item"><div class="stat-value">' + s.totalFiles + '</div><div class="stat-label">文件总数</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + s.totalSizeFormatted + '</div><div class="stat-label">占用空间</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + s.maxSizeFormatted + '</div><div class="stat-label">上传限制</div></div>' +
        '<div class="stat-item"><div class="stat-value">' + Object.keys(s.categories || {}).length + '</div><div class="stat-label">文件分类</div></div>';
    }

    // Toast 提示
    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast show ' + type;
      setTimeout(() => toast.className = 'toast', 2500);
    }

    function formatSize(bytes) {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i];
    }

    // 事件绑定
    searchInput.addEventListener('input', loadFiles);
    categoryFilter.addEventListener('change', loadFiles);
    sortSelect.addEventListener('change', loadFiles);

    // 初始化
    loadFiles();
    loadStats();
  </script>
</body>
</html>`;
  sendHTML(res, html);
}

/** POST /api/upload — 上传文件 */
async function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return send(res, 400, {
      success: false,
      error: 'Content-Type 必须为 multipart/form-data',
    });
  }

  try {
    const { fields, files } = await parseMultipart(req);

    if (!files.length) {
      return send(res, 400, { success: false, error: '未检测到上传文件' });
    }

    const results = [];
    for (const file of files) {
      // 校验文件大小
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          success: false,
          filename: file.filename,
          error: `文件大小 ${formatSize(file.size)} 超过限制 ${formatSize(MAX_FILE_SIZE)}`,
        });
        continue;
      }

      // 校验文件类型
      if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.includes(file.mimeType)) {
        results.push({
          success: false,
          filename: file.filename,
          error: `不支持的文件类型: ${file.mimeType}`,
        });
        continue;
      }

      // 校验文件名安全
      const safeName = path.basename(file.filename);
      if (safeName !== file.filename || safeName.includes('..')) {
        results.push({
          success: false,
          filename: file.filename,
          error: '文件名不合法',
        });
        continue;
      }

      const meta = saveFile(file, fields.description);
      results.push({
        success: true,
        filename: meta.originalName,
        id: meta.id,
        size: meta.size,
        sizeFormatted: formatSize(meta.size),
        mimeType: meta.mimeType,
        category: meta.category,
        duplicateOf: meta.duplicateOf,
        uploadedAt: meta.uploadedAt,
      });
    }

    const statusCode = results.every((r) => r.success) ? 201 : 207;
    send(res, statusCode, {
      success: results.every((r) => r.success),
      message: `成功上传 ${results.filter((r) => r.success).length}/${results.length} 个文件`,
      data: results,
    });
  } catch (err) {
    send(res, 500, { success: false, error: err.message });
  }
}

/** GET /api/files — 获取文件列表 */
function handleListFiles(req, res, parsedUrl) {
  const { search, category, type, sort, order } = parsedUrl.query || {};
  const files = listFiles({ search, category, type, sort, order });
  send(res, 200, {
    success: true,
    count: files.length,
    data: files.map((f) => ({
      ...f,
      sizeFormatted: formatSize(f.size),
    })),
  });
}

/** GET /api/files/:id — 获取文件详情 */
function handleGetFileInfo(req, res, id) {
  const meta = getFileInfo(id);
  if (!meta) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }
  send(res, 200, {
    success: true,
    data: { ...meta, sizeFormatted: formatSize(meta.size) },
  });
}

/** GET /api/files/:id/download — 下载文件 */
function handleDownloadFile(req, res, id) {
  const meta = getFileInfo(id);
  if (!meta) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  const filepath = path.join(UPLOAD_DIR, meta.storageName);
  if (!fs.existsSync(filepath)) {
    return send(res, 404, { success: false, error: '物理文件已丢失' });
  }

  // 安全检查：确保文件路径在上传目录内
  const resolvedPath = path.resolve(filepath);
  if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return send(res, 403, { success: false, error: '禁止访问' });
  }

  const stat = fs.statSync(filepath);
  res.writeHead(200, {
    'Content-Type': meta.mimeType,
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.originalName)}`,
    'Cache-Control': 'public, max-age=86400',
  });

  const stream = fs.createReadStream(filepath);
  stream.pipe(res);
}

/** DELETE /api/files/:id — 删除文件 */
function handleDeleteFile(req, res, id) {
  const meta = deleteFile(id);
  if (!meta) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }
  send(res, 200, {
    success: true,
    message: `文件 ${meta.originalName} 已删除`,
    data: { ...meta, sizeFormatted: formatSize(meta.size) },
  });
}

/** DELETE /api/files — 批量删除或清空 */
function handleClearFiles(req, res) {
  const all = Array.from(fileStore.values());
  for (const meta of all) {
    const filepath = path.join(UPLOAD_DIR, meta.storageName);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
  fileStore.clear();
  saveMeta();
  send(res, 200, { success: true, message: `已清空 ${all.length} 个文件` });
}

/** GET /api/stats — 存储统计 */
function handleStats(req, res) {
  send(res, 200, { success: true, data: getStats() });
}

/** PUT /api/files/:id — 更新文件描述 */
async function handleUpdateFile(req, res, id) {
  const meta = getFileInfo(id);
  if (!meta) {
    return send(res, 404, { success: false, error: '文件不存在' });
  }

  let body = '';
  await new Promise((resolve) => {
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', resolve);
  });

  try {
    const parsed = JSON.parse(body);
    if (parsed.description !== undefined) {
      meta.description = parsed.description;
    }
    fileStore.set(id, meta);
    saveMeta();
    send(res, 200, {
      success: true,
      data: { ...meta, sizeFormatted: formatSize(meta.size) },
    });
  } catch {
    send(res, 400, { success: false, error: '无效的 JSON' });
  }
}

// ============================================================
// 7. HTTP 请求路由
// ============================================================
async function handler(req, res) {
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
    // GET / — 上传页面
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res);
    }

    // POST /api/upload — 上传文件
    if (method === 'POST' && pathname === '/api/upload') {
      return await handleUpload(req, res);
    }

    // GET /api/files — 文件列表
    if (method === 'GET' && pathname === '/api/files') {
      return handleListFiles(req, res, parsedUrl);
    }

    // GET /api/stats — 统计信息
    if (method === 'GET' && pathname === '/api/stats') {
      return handleStats(req, res);
    }

    // DELETE /api/files — 清空所有文件
    if (method === 'DELETE' && pathname === '/api/files') {
      return handleClearFiles(req, res);
    }

    // 路由匹配：/api/files/:id 和 /api/files/:id/download
    const fileMatch = pathname.match(/^\/api\/files\/([a-f0-9-]+)(\/download)?$/);
    if (fileMatch) {
      const id = fileMatch[1];
      const isDownload = !!fileMatch[2];

      // GET /api/files/:id/download — 下载文件
      if (method === 'GET' && isDownload) {
        return handleDownloadFile(req, res, id);
      }

      // GET /api/files/:id — 文件详情
      if (method === 'GET' && !isDownload) {
        return handleGetFileInfo(req, res, id);
      }

      // PUT /api/files/:id — 更新文件信息
      if (method === 'PUT' && !isDownload) {
        return await handleUpdateFile(req, res, id);
      }

      // DELETE /api/files/:id — 删除文件
      if (method === 'DELETE' && !isDownload) {
        return handleDeleteFile(req, res, id);
      }
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
  ║           文件上传服务 - File Upload Service               ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║   服务地址: http://localhost:${PORT}                        ║
  ║                                                          ║
  ║   功能特性:                                               ║
  ║     • 纯 Node.js 实现，零外部依赖                          ║
  ║     • 手写 multipart/form-data 解析器                     ║
  ║     • 拖拽上传 + 多文件上传                                ║
  ║     • 文件类型校验 + 大小限制 (${formatSize(MAX_FILE_SIZE)})              ║
  ║     • SHA-256 哈希去重检测                                ║
  ║     • 文件搜索 / 分类 / 排序                              ║
  ║     • 在线预览图片 + 文件下载                              ║
  ║     • 元数据持久化存储                                     ║
  ║                                                          ║
  ║   API 端点:                                               ║
  ║     GET    /                    上传页面（HTML）            ║
  ║     POST   /api/upload          上传文件                   ║
  ║            (multipart/form-data)                          ║
  ║     GET    /api/files            文件列表                   ║
  ║            ?search=关键词        按名称搜索                 ║
  ║            ?category=图片        按分类过滤                 ║
  ║            ?sort=uploadedAt      按字段排序                 ║
  ║     GET    /api/files/:id        文件详情                   ║
  ║     GET    /api/files/:id/download 下载文件                ║
  ║     PUT    /api/files/:id        更新描述                   ║
  ║            { "description": "..." }                       ║
  ║     DELETE /api/files/:id        删除文件                   ║
  ║     DELETE /api/files            清空所有文件               ║
  ║     GET    /api/stats            存储统计信息               ║
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
