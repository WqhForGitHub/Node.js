// 规则引擎系统 - 纯 Node.js 实现
// 支持 JSON 规则定义、条件组合(AND/OR/NOT)、多种运算符、动作执行、规则优先级
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// ========= 规则引擎核心 =========
class RuleEngine {
  constructor() {
    this.rules = [];   // {id, name, priority, when, then, enabled}
    this.facts = {};   // 全局事实
  }

  addRule(rule) {
    if (!rule.id) rule.id = 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    rule.enabled = rule.enabled !== false;
    rule.priority = rule.priority || 0;
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    return rule;
  }

  removeRule(id) {
    const i = this.rules.findIndex(r => r.id === id);
    if (i >= 0) return this.rules.splice(i, 1)[0];
    return null;
  }

  // 取出嵌套字段, 如 "user.age"
  resolve(obj, key) {
    return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  // 单个条件求值
  evalCondition(cond, facts) {
    // 复合: { all: [...] } / { any: [...] } / { not: {...} }
    if (cond.all) return cond.all.every(c => this.evalCondition(c, facts));
    if (cond.any) return cond.any.some(c => this.evalCondition(c, facts));
    if (cond.not) return !this.evalCondition(cond.not, facts);

    // 简单条件: { fact, op, value }
    const left = this.resolve(facts, cond.fact);
    const right = cond.value;
    switch (cond.op) {
      case '==': case 'eq': return left == right;
      case '!=': case 'ne': return left != right;
      case '>': case 'gt': return left > right;
      case '>=': case 'gte': return left >= right;
      case '<': case 'lt': return left < right;
      case '<=': case 'lte': return left <= right;
      case 'in': return Array.isArray(right) && right.includes(left);
      case 'nin': return Array.isArray(right) && !right.includes(left);
      case 'contains': return typeof left === 'string' && left.includes(right);
      case 'startsWith': return typeof left === 'string' && left.startsWith(right);
      case 'endsWith': return typeof left === 'string' && left.endsWith(right);
      case 'regex': return new RegExp(right).test(String(left));
      case 'between': return Array.isArray(right) && left >= right[0] && left <= right[1];
      case 'exists': return left !== undefined && left !== null;
      default: throw new Error('未知运算符: ' + cond.op);
    }
  }

  // 执行 then 动作
  executeAction(action, facts, ctx) {
    const type = action.type;
    if (type === 'set') {
      // 设置事实字段
      this.setNested(facts, action.key, action.value);
      ctx.changes.push({ key: action.key, value: action.value });
    } else if (type === 'add') {
      const cur = this.resolve(facts, action.key) || 0;
      this.setNested(facts, action.key, cur + action.value);
      ctx.changes.push({ key: action.key, add: action.value });
    } else if (type === 'log') {
      ctx.logs.push(action.message);
    } else if (type === 'emit') {
      ctx.events.push({ event: action.event, payload: action.payload });
    } else if (type === 'stop') {
      ctx.stop = true;
    }
  }

  setNested(obj, key, val) {
    const parts = key.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      o[parts[i]] = o[parts[i]] || {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = val;
  }

  // 运行: 输入事实, 返回执行报告
  run(inputFacts) {
    const facts = JSON.parse(JSON.stringify({ ...this.facts, ...inputFacts }));
    const ctx = { fired: [], skipped: [], logs: [], events: [], changes: [], stop: false };

    for (const rule of this.rules) {
      if (ctx.stop) break;
      if (!rule.enabled) { ctx.skipped.push({ id: rule.id, reason: 'disabled' }); continue; }

      let matched = false;
      try { matched = this.evalCondition(rule.when, facts); }
      catch (e) { ctx.skipped.push({ id: rule.id, reason: 'error: ' + e.message }); continue; }

      if (matched) {
        ctx.fired.push({ id: rule.id, name: rule.name });
        const actions = Array.isArray(rule.then) ? rule.then : [rule.then];
        for (const a of actions) this.executeAction(a, facts, ctx);
      }
    }
    return { facts, ...ctx };
  }
}

// ========= 默认规则示例 =========
const engine = new RuleEngine();

engine.addRule({
  name: 'VIP 用户大额订单打折',
  priority: 100,
  when: { all: [
    { fact: 'user.level', op: '==', value: 'vip' },
    { fact: 'order.amount', op: '>=', value: 1000 }
  ]},
  then: [
    { type: 'set', key: 'order.discount', value: 0.2 },
    { type: 'log', message: 'VIP打折20%' }
  ]
});

engine.addRule({
  name: '普通用户小额无折扣',
  priority: 50,
  when: { all: [
    { fact: 'user.level', op: '!=', value: 'vip' },
    { fact: 'order.amount', op: '<', value: 500 }
  ]},
  then: { type: 'set', key: 'order.discount', value: 0 }
});

engine.addRule({
  name: '高风险用户拦截',
  priority: 200,
  when: { fact: 'user.riskScore', op: '>', value: 80 },
  then: [
    { type: 'set', key: 'order.blocked', value: true },
    { type: 'emit', event: 'risk_alert', payload: { reason: 'high risk' } },
    { type: 'stop' }
  ]
});

// ========= HTTP 服务 =========
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
        name: '规则引擎',
        rules: engine.rules.length,
        endpoints: [
          'GET  /rules                    列出规则',
          'POST /rules                    新增规则',
          'DELETE /rules/:id              删除',
          'POST /run                      运行规则 {facts}',
          'POST /toggle/:id               启用/禁用'
        ]
      });
    }
    if (pathname === '/rules' && req.method === 'GET') return send(res, 200, engine.rules);
    if (pathname === '/rules' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, engine.addRule(body));
    }
    if (pathname.startsWith('/rules/') && req.method === 'DELETE') {
      const id = pathname.split('/')[2];
      const r = engine.removeRule(id);
      return send(res, r ? 200 : 404, r || { error: 'Not Found' });
    }
    if (pathname.startsWith('/toggle/') && req.method === 'POST') {
      const id = pathname.split('/')[2];
      const r = engine.rules.find(x => x.id === id);
      if (!r) return send(res, 404, { error: 'Not Found' });
      r.enabled = !r.enabled;
      return send(res, 200, r);
    }
    if (pathname === '/run' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, engine.run(body.facts || body));
    }
    send(res, 404, { error: 'Not Found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

const PORT = 3090;
server.listen(PORT, () => {
  console.log(`[规则引擎] http://localhost:${PORT}`);
  console.log('示例: curl -X POST http://localhost:3090/run -d \'{"user":{"level":"vip","riskScore":10},"order":{"amount":2000}}\' -H "Content-Type: application/json"');
});

module.exports = { RuleEngine };
