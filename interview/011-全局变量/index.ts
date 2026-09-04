/**
 * 011 - Node.js 有哪些全局变量？
 *
 * 一、真全局（挂在 globalThis 上）：process、Buffer、console、定时器函数等
 * 二、CJS 伪全局（模块包装函数的形参）：__dirname、__filename、require、module、exports
 * 三、Web 标准全局（对齐浏览器）：fetch、URL、TextEncoder、structuredClone、
 *     AbortController、crypto、performance 等
 */

// 1. globalThis / global：全局对象本身，真全局变量都是它的属性
console.log('=== 1. globalThis / global ===');
console.log('typeof globalThis.process:', typeof globalThis.process);
console.log('global === globalThis:', global === (globalThis as typeof globalThis));

// 2. process：进程信息与控制
console.log('\n=== 2. process ===');
console.log('process.version:', process.version);
console.log('process.platform:', process.platform);
console.log('process.argv:', process.argv); // [node 路径, 脚本路径, ...用户参数]
console.log('process.cwd():', process.cwd());
// 常用还有：process.env、process.exit()、process.stdin/stdout、process.on('exit')

// 3. Buffer：二进制数据处理
console.log('\n=== 3. Buffer ===');
const buf = Buffer.from('全局变量');
console.log('buf:', buf, '| 字节长度:', buf.length); // UTF-8 中文占 3 字节

// 4. console：控制台输出
console.log('\n=== 4. console ===');
console.assert(1 === 1, '断言失败才打印');
console.time('计时');
console.timeEnd('计时');

// 5. 定时器函数：setTimeout / setInterval / setImmediate + clear 系列
console.log('\n=== 5. 定时器函数 ===');
clearTimeout(setTimeout(() => { }, 0));
clearInterval(setInterval(() => { }, 100));
clearImmediate(setImmediate(() => { }));
queueMicrotask(() => console.log('queueMicrotask：微任务'));

// 6. CJS 伪全局变量（ESM 中不存在）
console.log('\n=== 6. CJS 伪全局变量 ===');
console.log('__dirname:', __dirname);
console.log('__filename:', __filename);
console.log('typeof require:', typeof require);
console.log("'__dirname' in globalThis:", '__dirname' in globalThis); // false，不在全局对象上
// ESM 替代方案：import.meta.url + fileURLToPath

// 7. Web 标准全局变量
console.log('\n=== 7. Web 标准全局变量 ===');
const u = new URL('https://nodejs.org/docs?tab=api');
console.log('URL:', u.hostname, u.searchParams.get('tab'));

const encoded = new TextEncoder().encode('Hi');
console.log('TextEncoder → TextDecoder:', new TextDecoder().decode(encoded)); // Hi

const original: { map: Map<string, number>; self?: unknown } = { map: new Map([['a', 1]]) };
original.self = original; // 循环引用
const cloned = structuredClone(original);
console.log('structuredClone:', cloned.map.get('a'), cloned.self === cloned); // 1 true

const controller = new AbortController();
controller.abort();
console.log('AbortController aborted:', controller.signal.aborted);

console.log('performance.now():', performance.now().toFixed(3));
console.log('typeof fetch / crypto.randomUUID:', typeof fetch, typeof crypto.randomUUID);

// 8. 踩坑：模块顶层变量不是全局变量
console.log('\n=== 8. 模块变量 vs 全局变量 ===');
const moduleVar = 10; // 只在模块作用域内
console.log("'moduleVar' in globalThis:", 'moduleVar' in globalThis); // false
// 显式挂到 globalThis 才是真全局（不推荐：难追踪、易冲突，应改用模块导出）
(globalThis as Record<string, unknown>).appConfig = { env: 'dev' };
console.log('globalThis.appConfig:', (globalThis as Record<string, unknown>).appConfig);

// 9. 原理：CJS 模块代码被包进函数执行，伪全局是"形参"而非全局变量
// (function (exports, require, module, __filename, __dirname) { ... 模块代码 ... })();

export { };
