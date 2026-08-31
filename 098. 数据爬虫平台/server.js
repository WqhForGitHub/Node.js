/**
 * 数据爬虫平台 - 纯 Node.js 实现
 *
 * 核心架构：
 * 1. 爬虫调度引擎（Scheduler）：URL 优先级队列、去重、限流
 * 2. 下载器（Downloader）：HTTP/HTTPS 抓取，自动重试、UA 池
 * 3. 解析器（Parser）：HTML 提取（正则/CSS 选择器）
 * 4. 数据管道（Pipeline）：JSON Lines 持久化
 * 5. 任务管理（TaskManager）：多任务并行、状态追踪
 * 6. Web 控制台：创建/启停爬虫任务，查看实时数据
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const { EventEmitter } = require('events');

// ============ 简单 HTML 解析器（纯 JS 实现 CSS 选择器子集） ============
class SimpleParser {
  constructor(html) {
    this.html = html;
  }

  // 提取所有 <a href> 链接
  extractLinks(baseUrl) {
    const links = [];
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(this.html)) !== null) {
      try {
        const resolved = new URL(m[1], baseUrl).href;
        links.push({ url: resolved, text: m[2].replace(/<[^>]+>/g, '').trim() });
      } catch (e) {}
    }
    return links;
  }

  // 提取标题
  extractTitle() {
    const m = this.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? m[1].trim() : '';
  }

  // 提取 meta description
  extractMeta() {
    const meta = {};
    const re = /<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
    let m;
    while ((m = re.exec(this.html)) !== null) {
      meta[m[1]] = m[2];
    }
    return meta;
  }

  // 简单 CSS 选择器：支持 tag、.class、#id、tag.class
  select(selector) {
    const results = [];
    const tagMatch = selector.match(/^(\w+)?(?:\.([\w-]+))?(?:#([\w-]+))?$/);
    if (!tagMatch) return results;

    const [, tag, cls, id] = tagMatch;
    const tagPattern = tag || '\\w+';
    const re = new RegExp(`<(${tagPattern})([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');

    let m;
    while ((m = re.exec(this.html)) !== null) {
      const attrs = m[2];
      if (cls && !new RegExp(`class=["'][^"']*\\b${cls}\\b`, 'i').test(attrs)) continue;
      if (id && !new RegExp(`id=["']${id}["']`, 'i').test(attrs)) continue;
      results.push({ tag: m[1], attrs, content: m[3], text: m[3].replace(/<[^>]+>/g, '').trim() });
    }
    return results;
  }
}

// ============ 下载器 ============
class Downloader {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 3;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
    ];
  }

  randomUA() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  fetch(targetUrl, retries = 0) {
    return new Promise((resolve, reject) => {
      const parsed = url.parse(targetUrl);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.path,
          method: 'GET',
          timeout: this.timeout,
          headers: {
            'User-Agent': this.randomUA(),
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
        (res) => {
          // 处理重定向
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const next = new URL(res.headers.location, targetUrl).href;
            return resolve(this.fetch(next, retries));
          }

          let stream = res;
          if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
          else if (res.headers['content-encoding'] === 'deflate')
            stream = res.pipe(zlib.createInflate());

          const chunks = [];
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf-8'),
              url: targetUrl,
            });
          });
          stream.on('error', reject);
        }
      );

      req.on('timeout', () => req.destroy(new Error('Request timeout')));
      req.on('error', async (err) => {
        if (retries < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retries), 5000);
          console.log(
            `[Downloader] 重试 ${targetUrl} (${retries + 1}/${this.maxRetries}) ${delay}ms 后`
          );
          await new Promise((r) => setTimeout(r, delay));
          try {
            resolve(await this.fetch(targetUrl, retries + 1));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(err);
        }
      });
      req.end();
    });
  }
}

// ============ URL 队列（去重 + 优先级 + 限流） ============
class URLQueue {
  constructor() {
    this.queue = []; // [{url, depth, priority}]
    this.seen = new Set();
  }

  push(url, depth = 0, priority = 0) {
    if (this.seen.has(url)) return false;
    this.seen.add(url);
    this.queue.push({ url, depth, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    return true;
  }

  pop() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }

  seenCount() {
    return this.seen.size;
  }
}

// ============ 速率限制器（每域名独立） ============
class RateLimiter {
  constructor(intervalMs = 1000) {
    this.interval = intervalMs;
    this.lastAccess = new Map(); // hostname -> timestamp
  }

  async wait(targetUrl) {
    const host = new URL(targetUrl).hostname;
    const last = this.lastAccess.get(host) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < this.interval) {
      await new Promise((r) => setTimeout(r, this.interval - elapsed));
    }
    this.lastAccess.set(host, Date.now());
  }
}

// ============ 爬虫任务 ============
class SpiderTask extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || `task-${Date.now()}`;
    this.name = config.name || this.id;
    this.startUrls = config.startUrls || [];
    this.maxDepth = config.maxDepth ?? 2;
    this.maxPages = config.maxPages ?? 50;
    this.concurrency = config.concurrency || 3;
    this.allowedDomains = config.allowedDomains || [];
    this.rateLimit = config.rateLimit || 500;
    this.outputFile = config.outputFile;

    this.queue = new URLQueue();
    this.downloader = new Downloader();
    this.limiter = new RateLimiter(this.rateLimit);

    this.status = 'pending'; // pending/running/paused/completed/failed
    this.stats = { fetched: 0, failed: 0, items: 0, startedAt: null, finishedAt: null };
    this.activeWorkers = 0;
    this.items = [];
  }

  isAllowedDomain(targetUrl) {
    if (this.allowedDomains.length === 0) return true;
    try {
      const host = new URL(targetUrl).hostname;
      return this.allowedDomains.some((d) => host === d || host.endsWith('.' + d));
    } catch {
      return false;
    }
  }

  async start() {
    if (this.status === 'running') return;
    this.status = 'running';
    this.stats.startedAt = Date.now();
    this.startUrls.forEach((u) => this.queue.push(u, 0, 10));
    this.emit('start');

    const workers = Array.from({ length: this.concurrency }, (_, i) => this.worker(i));
    await Promise.all(workers);

    this.status = 'completed';
    this.stats.finishedAt = Date.now();
    this.emit('complete', this.stats);
  }

  pause() {
    this.status = 'paused';
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      const workers = Array.from({ length: this.concurrency }, (_, i) => this.worker(i));
      Promise.all(workers).then(() => {
        this.status = 'completed';
        this.stats.finishedAt = Date.now();
      });
    }
  }

  async worker(workerId) {
    while (this.status === 'running') {
      const item = this.queue.pop();
      if (!item) {
        if (this.activeWorkers === 0) break;
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      if (this.stats.fetched >= this.maxPages) break;

      this.activeWorkers++;
      try {
        await this.processUrl(item, workerId);
      } catch (e) {
        this.stats.failed++;
        this.emit('error', { url: item.url, error: e.message });
      } finally {
        this.activeWorkers--;
      }
    }
  }

  async processUrl({ url: targetUrl, depth }, workerId) {
    await this.limiter.wait(targetUrl);

    const res = await this.downloader.fetch(targetUrl);
    this.stats.fetched++;

    if (res.statusCode !== 200) {
      this.emit('page', { url: targetUrl, status: res.statusCode, worker: workerId });
      return;
    }

    const parser = new SimpleParser(res.body);
    const item = {
      url: targetUrl,
      depth,
      title: parser.extractTitle(),
      meta: parser.extractMeta(),
      contentLength: res.body.length,
      crawledAt: new Date().toISOString(),
    };

    this.items.push(item);
    this.stats.items++;
    this.savePipeline(item);
    this.emit('item', item);

    // 提取链接，加入队列
    if (depth < this.maxDepth) {
      const links = parser.extractLinks(targetUrl);
      for (const link of links) {
        if (this.isAllowedDomain(link.url)) {
          this.queue.push(link.url, depth + 1, this.maxDepth - depth);
        }
      }
    }
  }

  savePipeline(item) {
    if (!this.outputFile) return;
    fs.appendFileSync(this.outputFile, JSON.stringify(item) + '\n');
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      stats: this.stats,
      queueSize: this.queue.size(),
      seenCount: this.queue.seenCount(),
      activeWorkers: this.activeWorkers,
    };
  }
}

// ============ 任务管理器 ============
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
  }

  create(config) {
    const id = config.id || `task-${Date.now()}`;
    config.id = id;
    config.outputFile = path.join(this.dataDir, `${id}.jsonl`);
    const task = new SpiderTask(config);
    this.tasks.set(id, task);

    task.on('item', (item) => console.log(`[${id}] 抓取: ${item.title || item.url}`));
    task.on('complete', (stats) =>
      console.log(`[${id}] ✓ 完成: 抓取 ${stats.fetched} 页, 失败 ${stats.failed}`)
    );
    task.on('error', (e) => console.log(`[${id}] ✗ 失败: ${e.url} - ${e.error}`));

    return task;
  }

  list() {
    return Array.from(this.tasks.values()).map((t) => t.getInfo());
  }

  get(id) {
    return this.tasks.get(id);
  }

  getItems(id) {
    const t = this.tasks.get(id);
    return t ? t.items : [];
  }
}

// ============ Web 控制台 ============
const manager = new TaskManager();

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);

  if (u.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getHTML());
  }

  if (u.pathname === '/api/tasks' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(manager.list()));
  }

  if (u.pathname === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const config = JSON.parse(body);
        const task = manager.create(config);
        task.start().catch((e) => console.error(e));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, taskId: task.id }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (u.pathname.startsWith('/api/tasks/') && u.pathname.endsWith('/items')) {
    const id = u.pathname.split('/')[3];
    const items = manager.getItems(id).slice(-50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(items));
  }

  res.writeHead(404);
  res.end('Not Found');
});

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>数据爬虫平台</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, "Microsoft YaHei", sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
h1 { color: #2c3e50; }
.container { max-width: 1200px; margin: 0 auto; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; }
input, textarea, button { font-size: 14px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
input, textarea { width: 100%; margin-bottom: 10px; }
button { background: #3498db; color: white; border: none; cursor: pointer; padding: 10px 20px; }
button:hover { background: #2980b9; }
.task { padding: 15px; border-bottom: 1px solid #eee; }
.task:last-child { border-bottom: none; }
.status { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; color: white; }
.status-running { background: #27ae60; }
.status-completed { background: #95a5a6; }
.status-pending { background: #f39c12; }
.status-failed { background: #e74c3c; }
.stats { color: #7f8c8d; font-size: 13px; margin-top: 5px; }
.items { max-height: 300px; overflow-y: auto; margin-top: 10px; font-size: 12px; }
.item { padding: 5px; border-bottom: 1px dashed #eee; }
.item a { color: #3498db; text-decoration: none; }
label { display: block; margin-bottom: 5px; font-weight: bold; color: #34495e; }
</style>
</head>
<body>
<div class="container">
  <h1>数据爬虫平台</h1>

  <div class="card">
    <h3>创建爬虫任务</h3>
    <label>任务名称</label>
    <input id="name" placeholder="例如: example-spider">
    <label>起始 URL（每行一个）</label>
    <textarea id="startUrls" rows="3" placeholder="https://example.com"></textarea>
    <label>最大深度</label>
    <input id="maxDepth" type="number" value="2">
    <label>最大页数</label>
    <input id="maxPages" type="number" value="20">
    <label>并发数</label>
    <input id="concurrency" type="number" value="3">
    <label>限速间隔(ms)</label>
    <input id="rateLimit" type="number" value="500">
    <label>允许的域名（逗号分隔，留空表示所有）</label>
    <input id="allowedDomains" placeholder="example.com">
    <button onclick="createTask()">启动任务</button>
  </div>

  <div class="card">
    <h3>任务列表 <button onclick="loadTasks()" style="float:right;font-size:12px">刷新</button></h3>
    <div id="tasks">暂无任务</div>
  </div>
</div>

<script>
async function createTask() {
  const startUrls = document.getElementById('startUrls').value.split('\\n').map(s=>s.trim()).filter(Boolean);
  const allowedDomains = document.getElementById('allowedDomains').value.split(',').map(s=>s.trim()).filter(Boolean);
  const config = {
    name: document.getElementById('name').value || 'unnamed',
    startUrls,
    maxDepth: +document.getElementById('maxDepth').value,
    maxPages: +document.getElementById('maxPages').value,
    concurrency: +document.getElementById('concurrency').value,
    rateLimit: +document.getElementById('rateLimit').value,
    allowedDomains,
  };
  const r = await fetch('/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(config) });
  const j = await r.json();
  alert(j.success ? '任务已启动: ' + j.taskId : '失败: ' + j.error);
  loadTasks();
}

async function loadTasks() {
  const r = await fetch('/api/tasks');
  const tasks = await r.json();
  const html = tasks.length === 0 ? '暂无任务' : tasks.map(t => \`
    <div class="task">
      <strong>\${t.name}</strong>
      <span class="status status-\${t.status}">\${t.status}</span>
      <div class="stats">
        ID: \${t.id} | 已抓取: \${t.stats.fetched} | 失败: \${t.stats.failed} | 数据条数: \${t.stats.items} | 队列: \${t.queueSize}
      </div>
      <div class="items" id="items-\${t.id}"></div>
      <button onclick="loadItems('\${t.id}')" style="font-size:12px;padding:4px 8px;margin-top:5px">查看数据</button>
    </div>
  \`).join('');
  document.getElementById('tasks').innerHTML = html;
}

async function loadItems(id) {
  const r = await fetch('/api/tasks/' + id + '/items');
  const items = await r.json();
  const html = items.map(i => \`<div class="item"><a href="\${i.url}" target="_blank">\${i.title || i.url}</a></div>\`).join('');
  document.getElementById('items-' + id).innerHTML = html || '暂无数据';
}

setInterval(loadTasks, 3000);
loadTasks();
</script>
</body>
</html>`;
}

const PORT = process.env.PORT || 3098;
server.listen(PORT, () => {
  console.log(`数据爬虫平台已启动: http://localhost:${PORT}`);
});
