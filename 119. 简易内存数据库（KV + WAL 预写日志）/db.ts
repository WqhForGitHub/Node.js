/**
 * 简易内存数据库（KV + WAL 预写日志）
 *
 * - put/del/get 全部通过 WAL 文件先 append 后修改内存
 * - 启动时回放 WAL 重建内存状态
 * - 支持同步做 checkpoint（清空 WAL 并 dump 当前 KV）
 *
 * 运行：npx ts-node db.ts
 */
import * as fs from 'fs';

interface OpPut { op: 'put'; key: string; value: string | null; }
type Op = OpPut;

export class KVDB {
  private map = new Map<string, string>();
  private walFile: string;
  private checkpointFile: string;

  constructor(private dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.walFile = dir + '/wal.log';
    this.checkpointFile = dir + '/snapshot.json';
    this.recover();
  }

  private recover() {
    // 1. 读快照
    if (fs.existsSync(this.checkpointFile)) {
      const snap = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf8')) as [string, string][];
      for (const [k, v] of snap) this.map.set(k, v);
    }
    // 2. 应用 WAL
    if (fs.existsSync(this.walFile)) {
      const lines = fs.readFileSync(this.walFile, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const op = JSON.parse(line) as Op;
        if (op.op === 'put') {
          if (op.value === null) this.map.delete(op.key);
          else this.map.set(op.key, op.value);
        }
      }
    }
  }

  get(key: string) { return this.map.get(key); }

  put(key: string, value: string) {
    const op: Op = { op: 'put', key, value };
    fs.appendFileSync(this.walFile, JSON.stringify(op) + '\n');
    this.map.set(key, value);
  }

  del(key: string) {
    const op: Op = { op: 'put', key, value: null };
    fs.appendFileSync(this.walFile, JSON.stringify(op) + '\n');
    this.map.delete(key);
  }

  checkpoint() {
    fs.writeFileSync(this.checkpointFile, JSON.stringify([...this.map.entries()]));
    // 快照后清空 WAL
    fs.writeFileSync(this.walFile, '');
  }

  dump() {
    return [...this.map.entries()];
  }
}

const dir = process.argv[2] || './kvdata';
const db = new KVDB(dir);
db.put('name', 'Alice');
db.put('city', 'Beijing');
db.del('name');
db.put('lang', 'TypeScript');
console.log('name =', db.get('name'));   // undefined
console.log('city =', db.get('city'));   // Beijing
console.log('lang =', db.get('lang'));   // TypeScript
console.log('snapshot 前:', db.dump());
db.checkpoint();
console.log('完成 checkpoint；下次启动将直接从快照恢复');