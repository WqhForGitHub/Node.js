// 自动化部署服务 - 纯 Node.js 实现
// 支持: 项目注册、多环境部署、版本管理、回滚、部署日志、Webhook 触发
const http = require('http');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const RELEASES_DIR = path.join(__dirname, 'releases');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(RELEASES_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { projects: {}, deployments: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch {}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ========= 项目模型 =========
// { name, repo, environments: { dev:{steps:[], symlink:''}, prod:{...} }, current: { dev: deployId } }
// 部署记录: { id, project, env, version, status, logs, startTime, endTime, steps[] }

// ========= 命令执行 =========
function runStep(cmd, cwd) {
  return new Promise((resolve) => {
    const start = Date.now();
    const isWin = process.platform === 'win32';
    const child = spawn(cmd, { shell: true, cwd, env: { ...process.env } });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', (code) => {
      resolve({
        cmd, code, ok: code === 0,
        stdout: out.slice(0, 4000),
        stderr: err.slice(0, 4000),
        duration: Date.now() - start
      });
    });
    // 模拟最多 30s 超时
    setTimeout(() => { try { child.kill(); } catch {} }, 30000);
  });
}

// ========= 部署执行 =========
async function deploy(projectName, env, opts = {}) {
  const project = db.projects[projectName];
  if (!project) throw new Error('项目不存在');
  const envCfg = project.environments[env];
  if (!envCfg) throw new Error('环境不存在: ' + env);

  const id = 'd_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
  const version = opts.version || ('v' + Date.now());
  const releaseDir = path.join(RELEASES_DIR, projectName, env, version);
  fs.mkdirSync(releaseDir, { recursive: true });

  const dep = {
    id, project: projectName, env, version,
    status: 'running', logs: [], steps: [],
    startTime: Date.now(), releaseDir
  };
  db.deployments.unshift(dep);
  saveDb();

  // 执行步骤
  const steps = envCfg.steps || ['echo "no steps configured"'];
  dep.logs.push(`>>> 开始部署 ${projectName} -> ${env} (${version})`);
  for (const cmd of steps) {
    dep.logs.push(`$ ${cmd}`);
    const r = await runStep(cmd, releaseDir);
    dep.steps.push(r);
    dep.logs.push(r.stdout || r.stderr || '');
    if (!r.ok) {
      dep.status = 'failed';
      dep.error = `step failed: ${cmd}`;
      dep.endTime = Date.now();
      saveDb();
      return dep;
    }
  }
  // 切换 current 指针(模拟符号链接切流量)
  project.current = project.current || {};
  project.current[env] = { id, version, releaseDir, ts: Date.now() };
  dep.status = 'success';
  dep.endTime = Date.now();
  dep.logs.push('<<< 部署成功');
  saveDb();
  return dep;
}

// 回滚: 切换到历史成功部署
function rollback(projectName, env) {
  const project = db.projects[projectName];
  if (!project) throw new Error('项目不存在');
  // 找该环境最近一次成功的非当前部署
  const cur = project.current?.[env]?.id;
  const candidate = db.deployments.find(d =>
    d.project === projectName && d.env === env && d.status === 'success' && d.id !== cur);
  if (!candidate) throw new Error('无可回滚的历史版本');
  project.current[env] = { id: candidate.id, version: candidate.version, releaseDir: candidate.releaseDir, ts: Date.now() };
  saveDb();
  return { rolledBackTo: candidate };
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
        name: '自动化部署服务',
        endpoints: [
          'GET  /projects',
          'POST /projects                  注册项目',
          'POST /deploy/:project/:env      触发部署',
          'POST /rollback/:project/:env    回滚',
          'GET  /deployments',
          'GET  /deployments/:id',
          'POST /webhook/:project          Webhook 触发(默认部署 prod)'
        ]
      });
    }
    if (pathname === '/projects' && req.method === 'GET') return send(res, 200, db.projects);
    if (pathname === '/projects' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.name) return send(res, 400, { error: 'name 必填' });
      db.projects[body.name] = {
        name: body.name,
        repo: body.repo || '',
        environments: body.environments || { dev: { steps: ['echo deploying'] } },
        current: {}
      };
      saveDb();
      return send(res, 200, db.projects[body.name]);
    }
    if (pathname.startsWith('/deploy/') && req.method === 'POST') {
      const [, , project, env] = pathname.split('/');
      const body = await readBody(req);
      const dep = await deploy(project, env, body);
      return send(res, 200, dep);
    }
    if (pathname.startsWith('/rollback/') && req.method === 'POST') {
      const [, , project, env] = pathname.split('/');
      return send(res, 200, rollback(project, env));
    }
    if (pathname === '/deployments' && req.method === 'GET') {
      return send(res, 200, db.deployments.slice(0, 50));
    }
    if (pathname.startsWith('/deployments/')) {
      const id = pathname.split('/')[2];
      const d = db.deployments.find(x => x.id === id);
      return send(res, d ? 200 : 404, d || { error: 'Not Found' });
    }
    if (pathname.startsWith('/webhook/') && req.method === 'POST') {
      const project = pathname.split('/')[2];
      const body = await readBody(req);
      const dep = await deploy(project, body.env || 'prod', { version: body.version });
      return send(res, 200, { triggered: dep.id, status: dep.status });
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

// ========= 初始化默认项目 =========
if (!db.projects['demo-app']) {
  const echoCmd = process.platform === 'win32' ? 'echo' : 'echo';
  db.projects['demo-app'] = {
    name: 'demo-app',
    repo: 'https://github.com/example/demo-app',
    environments: {
      dev: { steps: [`${echoCmd} pulling code`, `${echoCmd} installing deps`, `${echoCmd} starting service`] },
      prod: { steps: [`${echoCmd} pulling code`, `${echoCmd} running tests`, `${echoCmd} building`, `${echoCmd} deploying`] }
    },
    current: {}
  };
  saveDb();
}

const PORT = 3092;
server.listen(PORT, () => {
  console.log(`[自动化部署] http://localhost:${PORT}`);
  console.log('示例: curl -X POST http://localhost:3092/deploy/demo-app/dev');
});
