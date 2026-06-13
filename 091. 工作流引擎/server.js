// 工作流引擎 - 纯 Node.js 实现
// 支持: DAG 节点编排、串行/并行/条件分支、节点重试、状态持久化、异步执行
const http = require('http');
const url = require('url');
const { EventEmitter } = require('events');

// ========= 节点处理器注册表 =========
const handlers = {
  // 通用任务
  'task.log': async (input, ctx) => {
    console.log('[LOG]', input.message);
    return { logged: input.message };
  },
  'task.delay': async (input) => {
    await new Promise(r => setTimeout(r, input.ms || 100));
    return { waited: input.ms };
  },
  'task.http': async (input) => {
    // 模拟 HTTP 调用
    return { status: 200, url: input.url, mock: true };
  },
  'task.compute': async (input, ctx) => {
    // 简单表达式: { expr: "a + b" }, 引用 ctx.vars
    const fn = new Function(...Object.keys(ctx.vars), 'return ' + input.expr);
    const result = fn(...Object.values(ctx.vars));
    return { result };
  },
  'task.email': async (input) => ({ sent: true, to: input.to, subject: input.subject }),
  'task.fail': async () => { throw new Error('intentional fail'); }
};

// ========= 工作流定义示例 =========
// 节点结构: { id, type, input, next: [], retry, condition }
// 特殊类型: 'start' / 'end' / 'condition' / 'parallel'
const workflows = {
  'order_process': {
    id: 'order_process',
    name: '订单处理流程',
    start: 'validate',
    nodes: {
      validate:  { id: 'validate', type: 'task.log', input: { message: '校验订单' }, next: ['check_stock'] },
      check_stock: { id: 'check_stock', type: 'task.compute', input: { expr: 'amount > 0 ? 1 : 0' }, next: ['branch'] },
      branch: {
        id: 'branch', type: 'condition',
        // cases 顺序匹配, default 兜底
        cases: [
          { when: 'last.result === 1', goto: 'parallel_node' },
          { when: 'true', goto: 'reject' }
        ]
      },
      parallel_node: {
        id: 'parallel_node', type: 'parallel',
        branches: ['pay', 'notify_warehouse'],
        next: ['finish']
      },
      pay: { id: 'pay', type: 'task.http', input: { url: 'https://pay.api/charge' }, retry: 2 },
      notify_warehouse: { id: 'notify_warehouse', type: 'task.email', input: { to: 'wh@a.com', subject: '发货' } },
      finish: { id: 'finish', type: 'task.log', input: { message: '订单完成' }, next: ['end'] },
      reject: { id: 'reject', type: 'task.log', input: { message: '订单拒绝' }, next: ['end'] },
      end: { id: 'end', type: 'end' }
    }
  }
};

// ========= 引擎 =========
class WorkflowEngine extends EventEmitter {
  constructor() {
    super();
    this.executions = {}; // id -> execution state
  }

  async start(workflowId, input = {}) {
    const wf = workflows[workflowId];
    if (!wf) throw new Error('workflow not found: ' + workflowId);
    const execId = 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const exec = {
      id: execId,
      workflowId,
      status: 'running',
      startTime: Date.now(),
      vars: { ...input },
      history: [],
      currentNode: wf.start
    };
    this.executions[execId] = exec;
    // 异步执行
    this.runNode(exec, wf, wf.start).then(() => {
      exec.status = 'completed';
      exec.endTime = Date.now();
      this.emit('completed', exec);
    }).catch(err => {
      exec.status = 'failed';
      exec.error = err.message;
      exec.endTime = Date.now();
      this.emit('failed', exec);
    });
    return execId;
  }

  async runNode(exec, wf, nodeId) {
    if (!nodeId || nodeId === 'end') return;
    const node = wf.nodes[nodeId];
    if (!node) throw new Error('node not found: ' + nodeId);

    if (node.type === 'end') {
      exec.history.push({ nodeId, type: 'end', ts: Date.now() });
      return;
    }

    if (node.type === 'condition') {
      exec.history.push({ nodeId, type: 'condition', ts: Date.now() });
      for (const c of node.cases) {
        const fn = new Function('last', 'vars', 'return (' + c.when + ');');
        if (fn(exec.vars.last || {}, exec.vars)) {
          return this.runNode(exec, wf, c.goto);
        }
      }
      return;
    }

    if (node.type === 'parallel') {
      exec.history.push({ nodeId, type: 'parallel.start', ts: Date.now() });
      await Promise.all(node.branches.map(b => this.runNode(exec, wf, b)));
      exec.history.push({ nodeId, type: 'parallel.end', ts: Date.now() });
      for (const n of (node.next || [])) await this.runNode(exec, wf, n);
      return;
    }

    // 普通任务
    const handler = handlers[node.type];
    if (!handler) throw new Error('handler not found: ' + node.type);
    const maxRetry = (node.retry || 0) + 1;
    let lastErr = null, output = null;
    for (let i = 0; i < maxRetry; i++) {
      try {
        const startTs = Date.now();
        output = await handler(node.input || {}, { vars: exec.vars, exec });
        exec.history.push({ nodeId, type: node.type, attempt: i + 1, ts: startTs, duration: Date.now() - startTs, output });
        exec.vars.last = output;
        exec.vars[nodeId] = output;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        exec.history.push({ nodeId, type: node.type, attempt: i + 1, ts: Date.now(), error: e.message });
      }
    }
    if (lastErr) throw lastErr;

    for (const n of (node.next || [])) await this.runNode(exec, wf, n);
  }

  registerWorkflow(wf) { workflows[wf.id] = wf; return wf; }
  registerHandler(type, fn) { handlers[type] = fn; }
  getExecution(id) { return this.executions[id]; }
  listExecutions() { return Object.values(this.executions); }
}

const engine = new WorkflowEngine();

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
        name: '工作流引擎',
        endpoints: [
          'GET  /workflows',
          'POST /workflows         注册工作流',
          'POST /run/:wfId         启动执行 {input}',
          'GET  /executions',
          'GET  /executions/:id'
        ]
      });
    }
    if (pathname === '/workflows' && req.method === 'GET') return send(res, 200, Object.keys(workflows));
    if (pathname === '/workflows' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, engine.registerWorkflow(body));
    }
    if (pathname.startsWith('/run/') && req.method === 'POST') {
      const wfId = pathname.split('/')[2];
      const body = await readBody(req);
      const execId = await engine.start(wfId, body.input || body);
      return send(res, 200, { execId });
    }
    if (pathname === '/executions' && req.method === 'GET') return send(res, 200, engine.listExecutions());
    if (pathname.startsWith('/executions/')) {
      const id = pathname.split('/')[2];
      const e = engine.getExecution(id);
      return send(res, e ? 200 : 404, e || { error: 'Not Found' });
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

const PORT = 3091;
server.listen(PORT, () => {
  console.log(`[工作流引擎] http://localhost:${PORT}`);
  console.log('示例: curl -X POST http://localhost:3091/run/order_process -d \'{"input":{"amount":100}}\' -H "Content-Type: application/json"');
});
