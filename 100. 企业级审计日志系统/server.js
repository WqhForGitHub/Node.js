/**
 * 企业级审计日志系统 - 纯 Node.js 实现
 *
 * 核心能力：
 * 1. 审计日志接收：HTTP/批量接收
 * 2. 标准化结构：actor/action/resource/result/context
 * 3. 完整性保护：哈希链（HashChain）防篡改
 * 4. 数字签名：HMAC-SHA256 服务端签名
 * 5. 不可变存储：按日期分片 + append-only
 * 6. 全文检索：基于倒排索引
 * 7. 复杂查询：多维度筛选 + 时间范围
 * 8. 合规导出：JSONL/CSV
 * 9. 完整性验证：链式校验
 * 10. Web 控制台：实时查询、统计、告警
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { EventEmitter } = require('events');

// ============ 配置 ============
const CONFIG = {
  storageDir: path.join(__dirname, 'audit-storage'),
  hmacSecret: process.env.AUDIT_HMAC_SECRET || 'demo-secret-key-change-in-production',
  port: process.env.PORT || 3100,
  retentionDays: 365,
};

if (!fs.existsSync(CONFIG.storageDir)) {
  fs.mkdirSync(CONFIG.storageDir, { recursive: true });
}

// ============ 审计日志存储引擎 ============
class AuditStorage extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.dataDir = config.storageDir;
    this.indexDir = path.join(this.dataDir, 'index');
    if (!fs.existsSync(this.indexDir)) fs.mkdirSync(this.indexDir, { recursive: true });

    // 内存索引（按字段建倒排索引）
    this.invertedIndex = {
      actor: new Map(), // value -> Set(eventId)
      action: new Map(),
      resource: new Map(),
      result: new Map(),
      severity: new Map(),
    };

    // 内存中的全部事件（生产环境应用 LRU 或仅索引）
    this.events = [];
    this.eventById = new Map();

    // 哈希链：lastHash 用于下一条事件的链接
    this.lastHash = this.loadLastHash();

    // 加载已存在数据
    this.loadAll();
  }

  loadLastHash() {
    const file = path.join(this.dataDir, '.lasthash');
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8').trim();
    return crypto.createHash('sha256').update('GENESIS').digest('hex');
  }

  saveLastHash() {
    fs.writeFileSync(path.join(this.dataDir, '.lasthash'), this.lastHash);
  }

  // 当天的存储文件路径
  getShardFile(date = new Date()) {
    const ymd = date.toISOString().slice(0, 10);
    return path.join(this.dataDir, `audit-${ymd}.jsonl`);
  }

  // 加载所有历史事件到内存索引
  loadAll() {
    if (!fs.existsSync(this.dataDir)) return;
    const files = fs.readdirSync(this.dataDir).filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl')).sort();
    let count = 0;
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.dataDir, file), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          this.indexEvent(event);
          count++;
        } catch (e) {}
      }
    }
    console.log(`[AuditStorage] 加载历史事件 ${count} 条`);
  }

  // 给事件计算签名和哈希链
  signAndChain(event) {
    // 标准化事件数据用于签名（确保字段顺序）
    const canonical = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      action: event.action,
      resource: event.resource,
      result: event.result,
      severity: event.severity,
      context: event.context,
      prevHash: this.lastHash,
    });

    // HMAC 签名
    event.signature = crypto.createHmac('sha256', this.config.hmacSecret).update(canonical).digest('hex');
    event.prevHash = this.lastHash;

    // 哈希链
    event.hash = crypto.createHash('sha256').update(canonical + event.signature).digest('hex');
    this.lastHash = event.hash;
  }

  // 写入审计事件（核心 API）
  write(rawEvent) {
    const now = new Date();
    const event = {
      id: crypto.randomBytes(12).toString('hex'),
      timestamp: rawEvent.timestamp || now.toISOString(),
      actor: rawEvent.actor || 'unknown',
      action: rawEvent.action || 'unknown',
      resource: rawEvent.resource || '',
      result: rawEvent.result || 'success', // success/failure/denied
      severity: rawEvent.severity || 'info', // info/warning/error/critical
      context: rawEvent.context || {},
      sourceIp: rawEvent.sourceIp || '',
      userAgent: rawEvent.userAgent || '',
    };

    // 签名并入哈希链
    this.signAndChain(event);

    // append-only 写入（不可变）
    fs.appendFileSync(this.getShardFile(now), JSON.stringify(event) + '\n');
    this.saveLastHash();

    this.indexEvent(event);
    this.emit('event', event);
    return event;
  }

  // 索引一个事件
  indexEvent(event) {
    this.events.push(event);
    this.eventById.set(event.id, event);

    for (const field of ['actor', 'action', 'resource', 'result', 'severity']) {
      const value = event[field];
      if (!this.invertedIndex[field].has(value)) {
        this.invertedIndex[field].set(value, new Set());
      }
      this.invertedIndex[field].get(value).add(event.id);
    }
  }

  // 多维度查询
  query(filter = {}) {
    let candidates = null;

    // 按倒排索引取交集
    for (const field of ['actor', 'action', 'resource', 'result', 'severity']) {
      if (filter[field]) {
        const ids = this.invertedIndex[field].get(filter[field]) || new Set();
        if (candidates === null) {
          candidates = new Set(ids);
        } else {
          candidates = new Set([...candidates].filter((id) => ids.has(id)));
        }
      }
    }

    // 全量扫描兜底
    let results = candidates ? [...candidates].map((id) => this.eventById.get(id)) : [...this.events];

    // 时间范围过滤
    if (filter.startTime) {
      results = results.filter((e) => e.timestamp >= filter.startTime);
    }
    if (filter.endTime) {
      results = results.filter((e) => e.timestamp <= filter.endTime);
    }

    // 全文检索（搜索 resource + context）
    if (filter.search) {
      const keyword = filter.search.toLowerCase();
      results = results.filter((e) =>
        JSON.stringify(e).toLowerCase().includes(keyword)
      );
    }

    // 排序（默认按时间倒序）
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const total = results.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return { total, items: results.slice(offset, offset + limit) };
  }

  // 完整性校验：从头开始重新计算哈希链
  verifyIntegrity(startDate, endDate) {
    const errors = [];
    let prevHash = crypto.createHash('sha256').update('GENESIS').digest('hex');
    let checkedCount = 0;

    // 全量按时间顺序扫描
    const sortedEvents = [...this.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const event of sortedEvents) {
      checkedCount++;

      // 校验 prevHash
      if (event.prevHash !== prevHash) {
        errors.push({
          id: event.id,
          timestamp: event.timestamp,
          error: 'PREV_HASH_MISMATCH',
          expected: prevHash,
          actual: event.prevHash,
        });
      }

      // 重新计算签名
      const canonical = JSON.stringify({
        id: event.id,
        timestamp: event.timestamp,
        actor: event.actor,
        action: event.action,
        resource: event.resource,
        result: event.result,
        severity: event.severity,
        context: event.context,
        prevHash: event.prevHash,
      });
      const expectedSig = crypto.createHmac('sha256', this.config.hmacSecret).update(canonical).digest('hex');
      if (event.signature !== expectedSig) {
        errors.push({ id: event.id, timestamp: event.timestamp, error: 'SIGNATURE_MISMATCH' });
      }

      // 计算下一个 prevHash
      prevHash = crypto.createHash('sha256').update(canonical + event.signature).digest('hex');
      if (event.hash !== prevHash) {
        errors.push({ id: event.id, timestamp: event.timestamp, error: 'HASH_MISMATCH' });
      }
    }

    return {
      ok: errors.length === 0,
      checkedCount,
      errors: errors.slice(0, 100),
      lastHash: prevHash,
    };
  }

  // 统计摘要
  getStats() {
    const stats = {
      total: this.events.length,
      byAction: {},
      byActor: {},
      byResult: {},
      bySeverity: {},
      last24h: 0,
      criticalEvents: 0,
    };
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    for (const e of this.events) {
      stats.byAction[e.action] = (stats.byAction[e.action] || 0) + 1;
      stats.byActor[e.actor] = (stats.byActor[e.actor] || 0) + 1;
      stats.byResult[e.result] = (stats.byResult[e.result] || 0) + 1;
      stats.bySeverity[e.severity] = (stats.bySeverity[e.severity] || 0) + 1;
      if (e.timestamp >= dayAgo) stats.last24h++;
      if (e.severity === 'critical') stats.criticalEvents++;
    }
    return stats;
  }

  // 导出 CSV
  exportCSV(filter) {
    const { items } = this.query({ ...filter, limit: 100000 });
    const headers = ['id', 'timestamp', 'actor', 'action', 'resource', 'result', 'severity', 'sourceIp'];
    const rows = [headers.join(',')];
    for (const e of items) {
      rows.push(headers.map((h) => `"${String(e[h] || '').replace(/"/g, '""')}"`).join(','));
    }
    return rows.join('\n');
  }
}

// ============ 告警引擎 ============
class AlertEngine {
  constructor(storage) {
    this.storage = storage;
    this.rules = [];
    this.alerts = [];

    storage.on('event', (event) => this.evaluate(event));

    // 默认规则
    this.addRule({
      name: '高危操作检测',
      match: (e) => e.severity === 'critical',
      message: (e) => `检测到高危操作：${e.actor} 执行 ${e.action} on ${e.resource}`,
    });
    this.addRule({
      name: '认证失败暴破检测',
      match: (e) => e.action === 'login' && e.result === 'failure',
      threshold: { count: 5, windowMs: 60000 },
      message: (e) => `${e.actor} 60秒内登录失败超过 5 次`,
    });
  }

  addRule(rule) {
    rule.recentMatches = [];
    this.rules.push(rule);
  }

  evaluate(event) {
    const now = Date.now();
    for (const rule of this.rules) {
      if (!rule.match(event)) continue;

      if (rule.threshold) {
        rule.recentMatches.push({ time: now, event });
        rule.recentMatches = rule.recentMatches.filter((m) => now - m.time < rule.threshold.windowMs);
        if (rule.recentMatches.length >= rule.threshold.count) {
          this.fireAlert(rule, event);
          rule.recentMatches = [];
        }
      } else {
        this.fireAlert(rule, event);
      }
    }
  }

  fireAlert(rule, event) {
    const alert = {
      id: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString(),
      rule: rule.name,
      message: rule.message(event),
      eventId: event.id,
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > 1000) this.alerts.length = 1000;
    console.log(`🚨 [告警] ${alert.message}`);
  }

  getAlerts(limit = 50) {
    return this.alerts.slice(0, limit);
  }
}

// ============ 服务初始化 ============
const storage = new AuditStorage(CONFIG);
const alertEngine = new AlertEngine(storage);

// ============ HTTP 服务 ============
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  try {
    // 写入审计事件
    if (u.pathname === '/api/audit' && req.method === 'POST') {
      const body = await readBody(req);
      body.sourceIp = body.sourceIp || req.socket.remoteAddress;
      body.userAgent = body.userAgent || req.headers['user-agent'];
      const event = storage.write(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, id: event.id, hash: event.hash }));
    }

    // 批量写入
    if (u.pathname === '/api/audit/batch' && req.method === 'POST') {
      const body = await readBody(req);
      const events = (body.events || []).map((e) => storage.write(e));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, count: events.length }));
    }

    // 查询
    if (u.pathname === '/api/audit/search' && req.method === 'GET') {
      const result = storage.query({
        actor: u.query.actor,
        action: u.query.action,
        resource: u.query.resource,
        result: u.query.result,
        severity: u.query.severity,
        startTime: u.query.startTime,
        endTime: u.query.endTime,
        search: u.query.q,
        offset: +(u.query.offset || 0),
        limit: +(u.query.limit || 50),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    }

    // 完整性校验
    if (u.pathname === '/api/audit/verify' && req.method === 'GET') {
      const result = storage.verifyIntegrity();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    }

    // 统计
    if (u.pathname === '/api/audit/stats' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(storage.getStats()));
    }

    // 告警
    if (u.pathname === '/api/alerts' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(alertEngine.getAlerts()));
    }

    // CSV 导出
    if (u.pathname === '/api/audit/export' && req.method === 'GET') {
      const csv = storage.exportCSV(u.query);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=audit-export-${Date.now()}.csv`,
      });
      return res.end('\uFEFF' + csv); // UTF-8 BOM 兼容 Excel
    }

    // Web 控制台
    if (u.pathname === '/' || u.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(getDashboardHTML());
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>企业级审计日志系统</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,"Microsoft YaHei",sans-serif;margin:0;background:#f3f4f6}
.header{background:#1f2937;color:white;padding:15px 30px;display:flex;justify-content:space-between;align-items:center}
.header h1{margin:0;font-size:20px}
.container{max-width:1400px;margin:20px auto;padding:0 20px}
.row{display:flex;gap:20px;margin-bottom:20px}.col{flex:1}
.card{background:white;border-radius:8px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.card h3{margin:0 0 15px 0;color:#1f2937;font-size:16px}
.stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6}
.stat:last-child{border-bottom:none}
.stat-value{font-weight:bold;color:#3b82f6}
input,select,button{padding:8px 12px;border:1px solid #d1d5db;border-radius:4px;font-size:13px}
input,select{width:100%;margin-bottom:8px}
button{background:#3b82f6;color:white;border:none;cursor:pointer}
button:hover{background:#2563eb}
button.danger{background:#dc2626}button.danger:hover{background:#b91c1c}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #e5e7eb}
th{background:#f9fafb;font-weight:600;color:#374151}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;color:white}
.s-info{background:#3b82f6}.s-warning{background:#f59e0b}.s-error{background:#ef4444}.s-critical{background:#7c2d12}
.r-success{background:#10b981}.r-failure{background:#ef4444}.r-denied{background:#f59e0b}
.alert{padding:10px;border-left:3px solid #ef4444;background:#fef2f2;margin-bottom:8px;font-size:13px}
.integrity-ok{color:#10b981;font-weight:bold}.integrity-fail{color:#ef4444;font-weight:bold}
</style></head><body>
<div class="header"><h1>🔒 企业级审计日志系统</h1><div id="status">加载中...</div></div>
<div class="container">

<div class="row">
<div class="col"><div class="card"><h3>📊 总览统计</h3><div id="stats">-</div></div></div>
<div class="col"><div class="card"><h3>🔐 完整性校验</h3>
<div id="integrity">点击下方按钮开始校验</div>
<button onclick="verify()" style="margin-top:10px">立即校验哈希链</button>
</div></div>
<div class="col"><div class="card"><h3>🚨 实时告警</h3><div id="alerts" style="max-height:200px;overflow-y:auto">无告警</div></div></div>
</div>

<div class="card" style="margin-bottom:20px">
<h3>📝 模拟事件写入（演示）</h3>
<div class="row">
<input id="actor" placeholder="操作者(如 admin/user-123)" value="admin">
<input id="action" placeholder="动作(如 login/delete/update)" value="login">
<input id="resource" placeholder="资源(如 /api/users/1)" value="/api/users">
<select id="result"><option value="success">成功</option><option value="failure">失败</option><option value="denied">拒绝</option></select>
<select id="severity"><option value="info">info</option><option value="warning">warning</option><option value="error">error</option><option value="critical">critical</option></select>
<button onclick="writeEvent()">写入审计</button>
<button onclick="batchSimulate()" style="background:#10b981">批量模拟</button>
</div>
</div>

<div class="card">
<h3>🔍 审计日志查询</h3>
<div class="row">
<input id="q-actor" placeholder="操作者">
<input id="q-action" placeholder="动作">
<input id="q-resource" placeholder="资源">
<select id="q-severity"><option value="">所有级别</option><option>info</option><option>warning</option><option>error</option><option>critical</option></select>
<input id="q-search" placeholder="全文搜索">
<button onclick="search()">查询</button>
<button onclick="exportCsv()">导出CSV</button>
</div>
<div id="results"></div>
</div>

</div>
<script>
async function api(path,opt){const r=await fetch(path,opt);return r.json()}

async function loadStats(){
  const s=await api('/api/audit/stats');
  document.getElementById('stats').innerHTML=\`
    <div class="stat"><span>总事件数</span><span class="stat-value">\${s.total}</span></div>
    <div class="stat"><span>近24小时</span><span class="stat-value">\${s.last24h}</span></div>
    <div class="stat"><span>高危事件</span><span class="stat-value" style="color:#dc2626">\${s.criticalEvents}</span></div>
    <div class="stat"><span>失败事件</span><span class="stat-value">\${s.byResult.failure||0}</span></div>
  \`;
  document.getElementById('status').textContent='事件总数: '+s.total;
}

async function verify(){
  document.getElementById('integrity').innerHTML='⏳ 校验中...';
  const r=await api('/api/audit/verify');
  document.getElementById('integrity').innerHTML=r.ok
    ? \`<div class="integrity-ok">✓ 完整性正常</div>已校验 \${r.checkedCount} 条记录<br>最新Hash: <code style="font-size:10px">\${r.lastHash.slice(0,32)}...</code>\`
    : \`<div class="integrity-fail">✗ 完整性受损!</div>错误数: \${r.errors.length}\`;
}

async function loadAlerts(){
  const a=await api('/api/alerts');
  document.getElementById('alerts').innerHTML=a.length===0?'无告警':a.slice(0,5).map(x=>
    \`<div class="alert"><strong>\${x.rule}</strong><br>\${x.message}<br><small>\${x.timestamp}</small></div>\`
  ).join('');
}

async function writeEvent(){
  const data={actor:actor.value,action:action.value,resource:resource.value,result:result.value,severity:severity.value,context:{from:'web-console'}};
  await api('/api/audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  loadStats();loadAlerts();search();
}

async function batchSimulate(){
  const actors=['admin','user-001','user-002','attacker','system'];
  const actions=['login','logout','create','delete','update','read','export'];
  const resources=['/api/users','/api/orders','/api/admin','/api/payments','/api/settings'];
  const results=['success','success','success','failure','denied'];
  const severities=['info','info','info','warning','error','critical'];
  const events=[];
  for(let i=0;i<20;i++){
    events.push({actor:actors[Math.floor(Math.random()*actors.length)],action:actions[Math.floor(Math.random()*actions.length)],resource:resources[Math.floor(Math.random()*resources.length)],result:results[Math.floor(Math.random()*results.length)],severity:severities[Math.floor(Math.random()*severities.length)],context:{simulated:true,batch:i}});
  }
  await api('/api/audit/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events})});
  loadStats();loadAlerts();search();
}

async function search(){
  const params=new URLSearchParams();
  if(document.getElementById('q-actor').value)params.set('actor',document.getElementById('q-actor').value);
  if(document.getElementById('q-action').value)params.set('action',document.getElementById('q-action').value);
  if(document.getElementById('q-resource').value)params.set('resource',document.getElementById('q-resource').value);
  if(document.getElementById('q-severity').value)params.set('severity',document.getElementById('q-severity').value);
  if(document.getElementById('q-search').value)params.set('q',document.getElementById('q-search').value);
  const r=await api('/api/audit/search?'+params);
  document.getElementById('results').innerHTML=\`<p>共 \${r.total} 条，显示 \${r.items.length} 条</p>
    <table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>资源</th><th>结果</th><th>级别</th><th>Hash</th></tr></thead>
    <tbody>\${r.items.map(e=>\`<tr><td>\${e.timestamp.slice(11,19)}</td><td>\${e.actor}</td><td>\${e.action}</td><td>\${e.resource}</td>
    <td><span class="badge r-\${e.result}">\${e.result}</span></td>
    <td><span class="badge s-\${e.severity}">\${e.severity}</span></td>
    <td><code style="font-size:10px">\${e.hash.slice(0,12)}</code></td></tr>\`).join('')}</tbody></table>\`;
}

function exportCsv(){
  const params=new URLSearchParams();
  ['q-actor','q-action','q-resource','q-severity','q-search'].forEach(id=>{const v=document.getElementById(id).value;if(v)params.set(id.slice(2),v)});
  window.location='/api/audit/export?'+params;
}

setInterval(()=>{loadStats();loadAlerts()},3000);
loadStats();loadAlerts();search();
</script></body></html>`;
}

server.listen(CONFIG.port, () => {
  console.log(`企业级审计日志系统已启动: http://localhost:${CONFIG.port}`);
  console.log('API 端点:');
  console.log('  POST /api/audit          写入单条审计事件');
  console.log('  POST /api/audit/batch    批量写入');
  console.log('  GET  /api/audit/search   多维度查询');
  console.log('  GET  /api/audit/verify   完整性校验');
  console.log('  GET  /api/audit/stats    统计摘要');
  console.log('  GET  /api/audit/export   CSV 导出');
  console.log('  GET  /api/alerts         告警列表');
  console.log(`存储目录: ${CONFIG.storageDir}`);
});
