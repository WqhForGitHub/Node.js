/**
 * url — 解析和处理 URL
 * 推荐使用 WHATWG 标准的 new URL()，旧的 url.parse() 已废弃
 */
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const raw = 'https://user:pass@www.example.com:8080/shop/list?kw=node.js#top';

// ---------- 1. 解析：URL 的每个组成部分一目了然 ----------
const u = new URL(raw);
console.log('协议 protocol :', u.protocol); // https:
console.log('用户名 username:', u.username); // user
console.log('主机 hostname  :', u.hostname); // www.example.com
console.log('端口 port      :', u.port); // 8080
console.log('路径 pathname  :', u.pathname); // /shop/list
console.log('锚点 hash      :', u.hash); // #top

// ---------- 2. 查询参数：searchParams 增删改查 ----------
u.searchParams.set('kw', 'typescript'); // 修改
u.searchParams.set('page', '2'); // 新增
u.searchParams.append('tag', 'demo'); // 追加（同名 key 可以有多个）
u.searchParams.append('tag', 'node');

console.log('\n查询参数：');
u.searchParams.forEach((v, k) => console.log(`  ${k} = ${v}`));
console.log('kw =', u.searchParams.get('kw'));
console.log('包含 tag 吗？', u.searchParams.has('tag'));
u.searchParams.delete('page');
console.log('删掉 page 后:', u.searchParams.toString());

// ---------- 3. URL 可直接当字符串用 ----------
console.log('\ntoString():', u.toString());

// ---------- 4. file:// 与本地路径互转（写 CLI 工具时常用） ----------
const local = path.join('E:', 'Code', 'demo.txt');
const fileUrl = pathToFileURL(local);
console.log('\n路径转 URL :', fileUrl.href);
console.log('URL 转回路径:', fileURLToPath(fileUrl));

// ---------- 5. 相对路径解析：以 base 为基准拼接 ----------
const page = new URL('/user/profile?id=1', raw);
console.log('\n相对路径解析:', page.toString());
