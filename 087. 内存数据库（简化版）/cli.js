// 交互式 CLI 客户端
const net = require('net');
const readline = require('readline');

const PORT = 7700;
const sock = net.connect(PORT, '127.0.0.1', () => {
  console.log('已连接到 memdb. 输入 help 查看命令.');
  prompt();
});

let pending = null;
let buf = '';
sock.on('data', (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (pending) { pending(JSON.parse(line)); pending = null; }
  }
});
sock.on('error', e => { console.error(e.message); process.exit(1); });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function send(cmd) {
  return new Promise((resolve) => { pending = resolve; sock.write(JSON.stringify(cmd) + '\n'); });
}

function prompt() {
  rl.question('memdb> ', async (input) => {
    input = input.trim();
    if (!input) return prompt();
    if (input === 'exit' || input === 'quit') { sock.end(); rl.close(); return; }
    if (input === 'help') {
      console.log(`命令示例:
  create users {pk:"id", fields:{email:{unique:true}, name:{index:true}}}
  insert users {name:"alice", email:"a@x.com", age:30}
  find users {age:{op:"gte", value:18}}
  get users 1
  update users 1 {age:31}
  delete users 1
  tables
  raw {"op":"insert","table":"users","row":{"name":"bob"}}`);
      return prompt();
    }

    try {
      const cmd = parseCommand(input);
      const r = await send(cmd);
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error('错误:', e.message);
    }
    prompt();
  });
}

function parseCommand(s) {
  if (s.startsWith('raw ')) return JSON.parse(s.slice(4));
  const parts = s.match(/^(\w+)\s*(.*)$/);
  if (!parts) throw new Error('解析失败');
  const verb = parts[1];
  const rest = parts[2];
  switch (verb) {
    case 'create': {
      const m = rest.match(/^(\w+)\s+(.+)$/);
      return { op: 'createTable', name: m[1], schema: evalObj(m[2]) };
    }
    case 'insert': {
      const m = rest.match(/^(\w+)\s+(.+)$/);
      return { op: 'insert', table: m[1], row: evalObj(m[2]) };
    }
    case 'find': {
      const m = rest.match(/^(\w+)\s*(.*)$/);
      return { op: 'find', table: m[1], where: m[2] ? evalObj(m[2]) : {} };
    }
    case 'get': {
      const m = rest.match(/^(\w+)\s+(.+)$/);
      return { op: 'get', table: m[1], pk: parseValue(m[2]) };
    }
    case 'update': {
      const m = rest.match(/^(\w+)\s+(\S+)\s+(.+)$/);
      return { op: 'update', table: m[1], pk: parseValue(m[2]), patch: evalObj(m[3]) };
    }
    case 'delete': {
      const m = rest.match(/^(\w+)\s+(.+)$/);
      return { op: 'delete', table: m[1], pk: parseValue(m[2]) };
    }
    case 'tables': return { op: 'tables' };
    default: throw new Error('unknown: ' + verb);
  }
}

function evalObj(s) {
  // 宽松：把 {a:1, b:"x"} 视作 JSON5 简化
  return Function('"use strict";return (' + s + ')')();
}
function parseValue(s) {
  if (/^\d+$/.test(s)) return parseInt(s);
  if (/^".*"$/.test(s)) return s.slice(1, -1);
  return s;
}
