/**
 * Demo 2 - util 工具函数
 * 运行：node "demo/02. 核心内置模块 API/2-util.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const util = require('node:util') as typeof import('node:util');

async function utilMain(): Promise<void> {
  // 1. format：printf 风格的字符串格式化，%j 输出 JSON
  console.log(util.format('%s 有 %d 个苹果', 'Tom', 3), '|', util.format('%j', { a: 1 }));

  // 2. inspect：depth 控制对象展开层数，null 为全部展开
  const deep = { user: { address: { geo: { lng: 116, lat: 39 } } } };
  console.log(util.inspect(deep), '|', util.inspect(deep, { depth: null }));

  // 3. types：比 typeof 更准确的类型判断
  console.log(util.types.isDate(new Date()), util.types.isPromise(Promise.resolve()));

  // 4. promisify：把 (err, result) 回调风格的函数转成 Promise
  function delay(ms: number, cb: (err: Error | null, msg: string) => void): void {
    setTimeout(() => cb(null, `等了 ${ms}ms`), ms);
  }
  console.log(await util.promisify(delay)(50));

  // 5. deprecate：给废弃 API 加调用警告（终端打印 DeprecationWarning）
  const oldApi = util.deprecate(() => '结果', 'oldApi() 已废弃，请改用 newApi()');
  console.log('返回值:', oldApi());

  // 6. styleText：终端彩色文字
  console.log(util.styleText('green', '成功'), util.styleText('red', '失败'));

  // 7. isDeepStrictEqual：只返回布尔值的深度比较
  console.log(util.isDeepStrictEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
}

utilMain();
