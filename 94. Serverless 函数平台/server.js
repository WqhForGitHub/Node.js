// Serverless 函数平台 - 纯 Node.js 实现
// 支持: 用户函数注册(JS 源码)、子进程 Sandbox 执行、HTTP 触发、版本管理、统计指标
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { fork, spawn } = require('child_process');
const crypto = require('crypto');
const { Worker } = require('worker_threads');

const FN_DIR = path.join(__dirname, 'functions');
fs.mkdirSync(FN_DIR, { recursive: true });

// 函数元数据 { name, code, runtime, version, createdAt, invocations, errors, totalMs }
const functions = {};
const FN_META = path.join(__dirname, 'meta.json');
try { Object.assign(functions, JSON.parse(fs.readFileSync(FN_META, 'utf-8'))); } catch {}
const saveMeta = () => fs.writeFileSync(FN_META, JSON.stringify(functions, null, 2));

// ========= Worker Runner 脚本(每次调用一个新 Worker, 内存隔离) =========
const RUNNER_FILE = path.join(__dirname, '_runner.js');
fs.writeFileSync(RUNNER_FILE, `
// Worker 入口: 接收 { code, event, context }, 执行 handler
const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

(async () => {
  const { code, event, context } = workerData;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    Buffer,
    setTimeout, setInterval, clearTimeout, clearInterval,
    process: { env: {} }
  };
  sandbox.exports = sandbox.module.exports;
  try {
    const script = new vm.Script(code, { filename: 'user.js', timeout: 5000 });
    script.runInNewContext(sandbox, { timeout: 5000 });
    const fn = sandbox.module.exports.handler || sandbox.module.exports;
    if (typeof fn !== 'function') throw new Error('No handler exported');
    const result = await Promise.resolve(fn(event, context));
    parentPort.postMessage({ ok: true, result });
  } catch (e) {
    parentPort.postMessage({ ok: false, error: e.message, stack: e.stack });
  }
})();
`);

function invokeFunction(name, event = {}) {
  return new Promise((resolve, reject) => {
    const fn = functions[name];
    if (!fn) return reject(new Error('Function not found'));
    const start = Date.now();
    const worker = new Worker(RUNNER_FILE, {
      workerData: {
        code: fn.code,
        event,
        context: { functionName: name, version: fn.version, requestId: 'r_' + Date.now() }
      }
    });
    const timer = setTimeout(() => {
      try { worker.terminate(); } catch {}
      reject(new Error('Function timeout (5s)'));
    }, 5000);

    worker.on('message', msg => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      fn.invocations = (fn.invocations || 0) + 1;
      fn.totalMs = (fn.totalMs || 0) + duration;
      if (!msg.ok) fn.errors = (fn.errors || 0) + 1;
      saveMeta();
      if (msg.ok) resolve({ result: msg.result, duration });
      else reject(new Error(msg.error));
    });
    worker.on('error', e => { clearTimeout(timer); reject(e); });
  });
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
  const { pathname, query } = url.parse(req.url, true);
  try {
    if (pathname === '/' && req.method === 'GET') {
      return send(res, 200, {
        name: 'Serverless 函数平台',
        runtime: 'Node.js Worker (vm sandbox)',
        functions: Object.keys(functions).length,
        endpoints: [
          'GET  /functions                列出函数',
          'POST /functions                创建/更新 {name, code}',
          'GET  /functions/:name          详情',
          'DELETE /functions/:name        删除',
          'POST /invoke/:name             调用 {event}',
          'ANY  /trigger/:name            HTTP 触发(等同 invoke,event 来自 query/body)',
          'GET  /metrics                  全局指标'
        ]
      });
    }

    if (pathname === '/functions' && req.method === 'GET') {
      return send(res, 200, Object.values(functions).map(f => ({
        name: f.name, version: f.version, invocations: f.invocations || 0,
        errors: f.errors || 0, avgMs: f.invocations ? Math.round(f.totalMs / f.invocations) : 0
      })));
    }
    if (pathname === '/functions' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.name || !body.code) return send(res, 400, { error: 'name 和 code 必填' });
      const existed = functions[body.name];
      functions[body.name] = {
        name: body.name,
        code: body.code,
        runtime: 'node',
        version: existed ? existed.version + 1 : 1,
        createdAt: existed?.createdAt || Date.now(),
        invocations: existed?.invocations || 0,
        errors: existed?.errors || 0,
        totalMs: existed?.totalMs || 0
      };
      saveMeta();
      return send(res, 200, { ok: true, version: functions[body.name].version });
    }
    if (pathname.startsWith('/functions/')) {
      const name = pathname.split('/')[2];
      if (req.method === 'GET') return send(res, functions[name] ? 200 : 404, functions[name] || { error: 'Not Found' });
      if (req.method === 'DELETE') {
        if (!functions[name]) return send(res, 404, { error: 'Not Found' });
        delete functions[name]; saveMeta();
        return send(res, 200, { ok: true });
      }
    }
    if (pathname.startsWith('/invoke/') && req.method === 'POST') {
      const name = pathname.split('/')[2];
      const body = await readBody(req);
      try {
        const out = await invokeFunction(name, body);
        return send(res, 200, out);
      } catch (e) { return send(res, 500, { error: e.message }); }
    }
    if (pathname.startsWith('/trigger/')) {
      const name = pathname.split('/')[2];
      const body = req.method === 'GET' ? {} : await readBody(req);
      const event = { method: req.method, query, body, headers: req.headers };
      try {
        const out = await invokeFunction(name, event);
        return send(res, 200, out);
      } catch (e) { return send(res, 500, { error: e.message }); }
    }
    if (pathname === '/metrics') {
      const total = Object.values(functions).reduce((acc, f) => {
        acc.invocations += f.invocations || 0;
        acc.errors += f.errors || 0;
        acc.totalMs += f.totalMs || 0;
        return acc;
      }, { invocations: 0, errors: 0, totalMs: 0 });
      return send(res, 200, { ...total, functions: Object.keys(functions).length });
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

// 默认示例函数
if (!functions['hello']) {
  functions['hello'] = {
    name: 'hello',
    code: `module.exports.handler = async (event, ctx) => {
  return { msg: 'Hello ' + (event.name || 'World'), reqId: ctx.requestId };
};`,
    runtime: 'node', version: 1, createdAt: Date.now(),
    invocations: 0, errors: 0, totalMs: 0
  };
  saveMeta();
}
if (!functions['sum']) {
  functions['sum'] = {
    name: 'sum',
    code: `module.exports = async (event) => {
  const arr = event.numbers || [];
  return { sum: arr.reduce((a,b)=>a+b, 0) };
};`,
    runtime: 'node', version: 1, createdAt: Date.now(),
    invocations: 0, errors: 0, totalMs: 0
  };
  saveMeta();
}

const PORT = 3094;
server.listen(PORT, () => {
  console.log(`[Serverless] http://localhost:${PORT}`);
  console.log('示例: curl -X POST http://localhost:3094/invoke/hello -d \'{"name":"Node"}\' -H "Content-Type: application/json"');
});
