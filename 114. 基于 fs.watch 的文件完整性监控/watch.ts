/**
 * 基于 fs.watch 的文件完整性监控
 *
 * 监听指定目录，记录每个文件的 size + mtimeMs 作为"指纹"。
 * 当 watch 事件触发时，重新统计指纹并对比，判断：
 *   - 新增（无指纹）
 *   - 删除（指纹消失）
 *   - 修改（指纹不同）
 * 同时计算每个文件的 SHA1，确认内容是否真的有变化。
 *
 * 运行：npx ts-node watch.ts [dir]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const target = path.resolve(process.argv[2] || '.');

interface Fingerprint {
  size: number;
  mtimeMs: number;
  sha1: string;
}

function sha1(file: string): string {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

function snapshot(): Map<string, Fingerprint> {
  const map = new Map<string, Fingerprint>();
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else map.set(full, { size: st.size, mtimeMs: st.mtimeMs, sha1: sha1(full) });
    }
  };
  walk(target);
  return map;
}

let prev = snapshot();
console.log(`初始快照: ${prev.size} 个文件`);

function diff(before: Map<string, Fingerprint>, after: Map<string, Fingerprint>) {
  for (const [k, v] of after) {
    const old = before.get(k);
    if (!old) console.log(`[新增] ${k} (${v.size}B) sha1=${v.sha1.slice(0, 8)}`);
    else if (old.sha1 !== v.sha1) console.log(`[修改] ${k} sha1 ${old.sha1.slice(0,8)} -> ${v.sha1.slice(0,8)}`);
    else if (old.size !== v.size || old.mtimeMs !== v.mtimeMs)
      console.log(`[元数据变了] ${k} size=${old.size}->${v.size}`);
  }
  for (const k of before.keys()) {
    if (!after.has(k)) console.log(`[删除] ${k}`);
  }
}

let timer: NodeJS.Timeout | null = null;
const watcher = fs.watch(target, { recursive: true }, (eventType, filename) => {
  // 合并抖动
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const cur = snapshot();
    diff(prev, cur);
    prev = cur;
  }, 200);
});

process.on('SIGINT', () => {
  watcher.close();
  console.log('\n停止监控');
  process.exit(0);
});