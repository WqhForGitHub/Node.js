/**
 * util — 内置工具函数大杂烩
 */
import { promisify, callbackify, format, inspect, deprecate, types } from 'node:util';

// ---------- 1. promisify：把「回调风格」函数包装成返回 Promise 的函数 ----------
function delay(ms: number, cb: (err: Error | null, msg: string) => void) {
  setTimeout(() => cb(null, `${ms}ms 时间到`), ms);
}
const delayAsync = promisify(delay);

// ---------- 2. callbackify：反向操作，把 async 函数变回回调风格 ----------
const delayCb = callbackify(delayAsync);

// ---------- 3. format：printf 风格格式化（%s 字符串 %d 数字 %j JSON） ----------
console.log(format('格式化：%s 吃了 %d 个苹果', '小明', 3));

// ---------- 4. inspect：把对象转成可读字符串，比 JSON.stringify 更适合调试 ----------
const deep = { a: { b: { c: { d: [1, 2, 3] } } }, when: new Date() };
console.log(inspect(deep, { depth: 2 })); // depth 控制展开层级

// ---------- 5. deprecate：给废弃函数加警告，调用时提醒开发者迁移 ----------
const oldQuery = deprecate(() => '老接口的返回值', 'oldQuery() 已废弃，请改用 newQuery()');
console.log(oldQuery()); // 能正常执行，但 stderr 会打印废弃警告

// ---------- 6. types：精确判断内置类型（比 typeof 强） ----------
console.log('是 Promise 吗:', types.isPromise(Promise.resolve())); // true
console.log('是 Date 吗    :', types.isDate(new Date())); // true

async function main() {
  // promisify 的结果可以直接 await
  const msg = await delayAsync(100);
  console.log('promisify  :', msg);

  // callbackify 的结果用回调接收
  delayCb(50, (err, msg) => {
    console.log('callbackify:', err ? err.message : msg);
  });
}

main();
