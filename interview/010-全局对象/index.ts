/**
 * 010 - 什么是 Node.js 全局对象？有哪些全局对象？
 *
 * 全局对象：在任何模块中都可以直接使用、无需 require/import 的对象和函数。
 * Node.js 的全局对象是 globalThis（别名 global），对应浏览器里的 window。
 *
 * 注意：__dirname / __filename / require / module / exports
 *      并不是真正的全局变量，而是 CommonJS 模块包装函数的参数，
 *      只是"看起来像全局"，ESM 模块中没有它们。
 */

// ============================================================
// 1. globalThis / global：全局对象本身
// ============================================================
console.log('=== 1. globalThis / global ===');
(globalThis as Record<string, unknown>).myGlobal = '我挂在全局对象上';
console.log('globalThis.myGlobal =', (globalThis as Record<string, unknown>).myGlobal);
console.log('globalThis === global:', (globalThis as unknown) === global);

// ============================================================
// 2. process：当前进程信息与控制（最常用的全局对象）
// ============================================================
console.log('\n=== 2. process ===');
console.log('process.version:        ', process.version);
console.log('process.platform:       ', process.platform);
console.log('process.pid:            ', process.pid);
console.log('process.argv:           ', process.argv.slice(2)); // 命令行参数
console.log('process.env.NODE_ENV:   ', process.env.NODE_ENV ?? '(未设置)');
console.log('process.cwd():          ', process.cwd()); // 当前工作目录
console.log('process.uptime():       ', process.uptime().toFixed(4), '秒');
// 常用方法：process.exit(code) 退出进程
//          process.on('exit'|'uncaughtException', handler) 监听事件
//          process.stdout / stderr 标准输出流

// ============================================================
// 3. Buffer：处理二进制数据
// ============================================================
console.log('\n=== 3. Buffer ===');
const buf: Buffer = Buffer.from('Hello');
console.log('Buffer.from("Hello") =', buf);
console.log('字节长度:', buf.length);
console.log('转字符串:', buf.toString());
console.log('转十六进制:', buf.toString('hex'));

// ============================================================
// 4. console：控制台输出
// ============================================================
console.log('\n=== 4. console ===');
console.log('console.log   - 普通日志');
console.error('console.error - 错误日志（输出到 stderr）');
console.warn('console.warn  - 警告日志');
console.table([
  { name: 'global', type: '对象' },
  { name: 'process', type: '对象' },
]);

// ============================================================
// 5. 定时器函数：setTimeout / setInterval / setImmediate / queueMicrotask
// ============================================================
console.log('\n=== 5. 定时器（全局函数） ===');
const timer: NodeJS.Timeout = setTimeout(() => {
  console.log('setTimeout：一次性延时执行');
}, 0);
clearTimeout(timer); // 立刻取消，所以上面那句不会输出

const interval: NodeJS.Timeout = setInterval(() => {
  console.log('（不会输出）setInterval：重复执行');
}, 100);
clearInterval(interval); // 立刻取消

setImmediate(() => {
  console.log('setImmediate：当前事件循环 check 阶段执行');
});

queueMicrotask(() => {
  console.log('queueMicrotask：微任务，紧跟同步代码执行');
});

// ============================================================
// 6. 模块级"伪全局"变量（仅 CommonJS 中可用）
// ============================================================
console.log('\n=== 6. 模块级变量（CJS 伪全局） ===');
console.log('__dirname（当前文件所在目录）:', __dirname);
console.log('__filename（当前文件完整路径）:', __filename);
console.log('typeof require =', typeof require);
console.log('typeof module =', typeof module);
console.log('typeof exports =', typeof exports);
