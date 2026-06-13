// CI/CD 简化系统 - 纯 Node.js 实现
// 支持: Pipeline 配置(stages -> jobs -> steps)、并行 job、artifact、构建队列、Webhook 触发
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { pipelines: {}, builds: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch {}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ========= Pipeline 配置 =========
// pipeline: { name, trigger:['push','manual'], stages:[ {name, jobs:[ {name, steps:['cmd1'], artifacts:['file']} ]} ]}
// 默认 stage 串行,同 stage 内 jobs 并行

// ========= 构建队列 =========
const queue = [];
let running = 0;
const CONCURRENCY = 2;

async function exec(cmd, cwd) {
  return new Promise(resolve => {
    const start = Date.now();
    const child = spawn(cmd, { shell: true, cwd });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => {
      resolve({ cmd, code, ok: code === 0, stdout: out, stderr: err, duration: Date.now() - start });
    });
    setTimeout(() => { try { child.kill(); } catch {} }, 60000);
  });
}

async function runJob(job, build, stageName) {
  const jobRecord = { name: job.name, stage: stageName, steps: [], status: 'running', startTime: Date.now() };
  build.jobs.push(jobRecord);
  for (const step of (job.steps || [])) {
    const r = await exec(step, build.workspace);
    jobRecord.steps.push(r);
    build.logs.push(`[${stageName}/${job.name}] $ ${step}\n${r.stdout || r.stderr || ''}`);
    if (!r.ok) {
      jobRecord.status = 'failed';
      jobRecord.endTime = Date.now();
      throw new Error(`Job ${job.name} failed at: ${step}`);
    }
  }
  // 收集 artifacts(只是记录文件存在)
  jobRecord.artifacts = [];
  for (const a of (job.artifacts || [])) {
    const p = path.join(build.workspace, a);
    if (fs.existsSync(p)) jobRecord.artifacts.push(a);
  }
  jobRecord.status = 'success';
  jobRecord.endTime = Date.now();
}

async function runBuild(build) {
  build.status = 'running';
  build.startTime = Date.now();
  fs.mkdirSync(build.workspace, { recursive: true });
  saveDb();

  const pipeline = db.pipelines[build.pipeline];
  if (!pipeline) {
    build.status = 'failed'; build.error = 'pipeline not found'; build.endTime = Date.now(); saveDb(); return;
  }

  try {
    for (const stage of pipeline.stages) {
      build.logs.push(`====== Stage: ${stage.name} ======`);
      // 并行 job
      await Promise.all(stage.jobs.map(j => runJob(j, build, stage.name)));
    }
    build.status = 'success';
  } catch (e) {
    build.status = 'failed';
    build.error = e.message;
  }
  build.endTime = Date.now();
  build.duration = build.endTime - build.startTime;
  saveDb();
}

function enqueueBuild(pipelineName, trigger = 'manual', meta = {}) {
  const id = 'b_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
  const build = {
    id, pipeline: pipelineName, trigger, meta,
    status: 'queued', queuedAt: Date.now(),
    logs: [], jobs: [],
    workspace: path.join(DATA_DIR, 'workspaces', id)
  };
  db.builds.unshift(build);
  saveDb();
  queue.push(build);
  drain();
  return build;
}

function drain() {
  while (running < CONCURRENCY && queue.length > 0) {
    const b = queue.shift();
    running++;
    runBuild(b).finally(() => { running--; drain(); });
  }
}

// ========= HTTP API =========
function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}
function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);
  try {
    if (pathname === '/' && req.method === 'GET') {
      return send(res, 200, {
        name: 'CI/CD 简化系统',
        running, queued: queue.length,
        endpoints: [
          'GET  /pipelines',
          'POST /pipelines               注册 pipeline',
          'POST /trigger/:pipeline       触发构建',
          'POST /webhook/:pipeline       Webhook',
          'GET  /builds',
          'GET  /builds/:id',
          'GET  /builds/:id/logs'
        ]
      });
    }
    if (pathname === '/pipelines' && req.method === 'GET') return send(res, 200, db.pipelines);
    if (pathname === '/pipelines' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.name || !Array.isArray(body.stages)) return send(res, 400, { error: 'name 和 stages 必填' });
      db.pipelines[body.name] = body;
      saveDb();
      return send(res, 200, body);
    }
    if (pathname.startsWith('/trigger/') && req.method === 'POST') {
      const name = pathname.split('/')[2];
      const body = await readBody(req);
      const b = enqueueBuild(name, 'manual', body);
      return send(res, 200, { id: b.id, status: b.status });
    }
    if (pathname.startsWith('/webhook/') && req.method === 'POST') {
      const name = pathname.split('/')[2];
      const body = await readBody(req);
      const b = enqueueBuild(name, 'webhook', body);
      return send(res, 200, { id: b.id });
    }
    if (pathname === '/builds' && req.method === 'GET') {
      return send(res, 200, db.builds.slice(0, 30).map(b => ({
        id: b.id, pipeline: b.pipeline, status: b.status,
        queuedAt: b.queuedAt, duration: b.duration
      })));
    }
    if (pathname.startsWith('/builds/') && pathname.endsWith('/logs')) {
      const id = pathname.split('/')[2];
      const b = db.builds.find(x => x.id === id);
      if (!b) return send(res, 404, { error: 'Not Found' });
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(b.logs.join('\n'));
    }
    if (pathname.startsWith('/builds/')) {
      const id = pathname.split('/')[2];
      const b = db.builds.find(x => x.id === id);
      return send(res, b ? 200 : 404, b || { error: 'Not Found' });
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

// ========= 默认 pipeline =========
if (!db.pipelines['hello-ci']) {
  db.pipelines['hello-ci'] = {
    name: 'hello-ci',
    trigger: ['push', 'manual'],
    stages: [
      { name: 'build', jobs: [
        { name: 'compile', steps: ['echo "compiling..."', 'echo done > out.txt'], artifacts: ['out.txt'] }
      ]},
      { name: 'test', jobs: [
        { name: 'unit',        steps: ['echo "running unit tests"'] },
        { name: 'integration', steps: ['echo "running integration"'] }
      ]},
      { name: 'deploy', jobs: [
        { name: 'release', steps: ['echo "deployed!"'] }
      ]}
    ]
  };
  saveDb();
}

const PORT = 3093;
server.listen(PORT, () => {
  console.log(`[CI/CD] http://localhost:${PORT}`);
  console.log('示例: curl -X POST http://localhost:3093/trigger/hello-ci');
});
