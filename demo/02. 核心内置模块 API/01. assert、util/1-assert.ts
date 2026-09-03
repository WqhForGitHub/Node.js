/**
 * Demo 1 - assert 断言
 * 运行：node "demo/02. 核心内置模块 API/1-assert.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const assert: typeof import('node:assert/strict') = require('node:assert/strict');

// 1. ok：断言为真值
assert.ok(true);

// 2. equal / notEqual：严格相等（===）与不相等
assert.equal(1, 1);
assert.notEqual(1, 2);

// 3. deepEqual：深度比较对象/数组
assert.deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] });

// 4. throws：断言函数抛出指定异常
assert.throws(() => JSON.parse('不是 json'), SyntaxError);

// 5. ifError：断言值为 null 或 undefined
assert.ifError(null);

// 6. 断言失败会抛出 AssertionError
try {
  assert.equal(1, 2, '1 不等于 2');
} catch (err) {
  console.log('断言失败:', (err as Error).message);
}

console.log('全部通过');
