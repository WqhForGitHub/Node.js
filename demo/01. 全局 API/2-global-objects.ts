/**
 * Demo 2 - 全局对象与模块变量
 * 运行：node "demo/01. 全局 API/2-global-objects.ts"（Node 22.18+）
 */

// 无 import/export 时 TS 视为全局脚本，加前缀避免与其它 demo 冲突
async function demo2Main(): Promise<void> {
  // 1. globalThis：跨环境标准的全局根对象；global 仅 Node 有效
  console.log('=== 1. globalThis ===');
  console.log('globalThis === global :', globalThis === global); // true

  // 2. process：进程信息与控制
  console.log('\n=== 2. process ===');
  console.log('版本/平台 :', process.version, process.platform, '/', process.arch);
  console.log('PID       :', process.pid);
  console.log('工作目录  :', process.cwd()); // 执行 node 命令的目录，区别于 __dirname
  console.log('命令行参数 :', process.argv); // [node 路径, 脚本路径, ...参数]
  console.log('环境变量数 :', Object.keys(process.env).length);
  console.log('内存 rss  :', (process.memoryUsage().rss / 1024 / 1024).toFixed(1), 'MB');

  // 退出前触发，适合收尾清理
  process.on('exit', (code) => console.log(`\n[exit 事件] 退出码: ${code}`));

  // 3. console：table 打表格、time 计时
  console.log('\n=== 3. console ===');
  console.log('log 走 stdout');
  console.error('warn / error 走 stderr');

  console.table([
    { name: 'globalThis', kind: '对象' },
    { name: 'setTimeout', kind: '函数' },
  ]);

  console.time('空循环 100 万次');
  for (let i = 0; i < 1_000_000; i++) {
    // 模拟耗时
  }
  console.timeEnd('空循环 100 万次');

  // 4. Buffer：自带编码转换的字节数组（Node 特有）
  console.log('\n=== 4. Buffer ===');
  const buf = Buffer.from('Hello Node.js', 'utf8');
  console.log(
    '长度 :',
    buf.length,
    '| hex:',
    buf.toString('hex'),
    '| base64:',
    buf.toString('base64')
  );
  console.log(
    '拼接 :',
    Buffer.concat([Buffer.from('你好, '), Buffer.from('Node')]).toString('utf8')
  );

  // 5. AbortController：异步任务的取消按钮（abort 取消，signal 传信号）
  console.log('\n=== 5. AbortController ===');

  // 可取消的延时：收到 abort 信号就停掉定时器并失败
  function delay(ms: number, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(`等满 ${ms}ms`), ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true }
      );
    });
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('被主动取消')), 100); // 100ms 后打断 5 秒等待

  try {
    await delay(5000, controller.signal);
  } catch (err) {
    console.log('捕获中止原因:', (err as Error).message);
  }
  console.log('aborted:', controller.signal.aborted); // true；AbortSignal.timeout(n) 是超时快捷方式

  // 6. TextEncoder / TextDecoder：字符串 <-> 字节
  console.log('\n=== 6. TextEncoder / TextDecoder ===');
  const bytes = new TextEncoder().encode('你好 Node'); // 只支持编码成 UTF-8
  console.log('UTF-8 字节 :', bytes); // 中文每字 3 字节
  // 内置 ICU，TextDecoder 还认识 GBK；这 4 字节是 GBK 的「你好」
  console.log('GBK 解码   :', new TextDecoder('gbk').decode(Buffer.from([0xc4, 0xe3, 0xba, 0xc3])));

  // 7. URL / URLSearchParams：网址解析与修改
  console.log('\n=== 7. URL ===');
  const url = new URL('https://nodejs.org/docs/api?tab=fs&page=2#url');
  console.log('pathname:', url.pathname, '| search:', url.search, '| hash:', url.hash);

  // searchParams 直接读写查询参数，URL 自动同步更新
  url.searchParams.set('page', '3'); // 改
  url.searchParams.append('lang', 'zh'); // 增
  url.searchParams.delete('tab'); // 删
  console.log('修改后:', url.toString());

  // 也可脱离 URL 单独处理 a=1&b=2 查询串（可直接 for...of 遍历）
  const qs = new URLSearchParams('a=1&b=2&c=3');
  console.log('get("b"):', qs.get('b')); // 2

  // 8. WebAssembly：运行 wasm 二进制（C/Rust 编译产物，接近原生速度）
  // 固定四步：validate 检查 -> Module 编译 -> Instance 实例化 -> exports 调用
  console.log('\n=== 8. WebAssembly ===');

  // 最小 wasm 模块：导出 main() 返回 42（字节无需看懂）
  const wasmBytes = new Uint8Array(
    Buffer.from(
      '0061736d01000000' + // 魔数 "\0asm" + 版本号
        '0105016000017f' + // 类型段：() -> i32
        '03020100' + // 函数段
        '070801046d61696e0000' + // 导出段："main"
        '0a06010400412a0b', // 代码段：i32.const 42; end
      'hex'
    )
  );

  console.log('合法字节:', WebAssembly.validate(wasmBytes)); // true
  const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes)); // 编译 + 实例化
  console.log('main() 返回:', (instance.exports.main as () => number)()); // 42

  // 9. 模块变量：并非全局变量！Node 把 CommonJS 文件包进包裹函数，它们只是参数：
  //   (function (exports, require, module, __filename, __dirname) { ...你的代码... })();
  console.log('\n=== 9. 模块变量 ===');
  console.log('__dirname  :', __dirname); // 当前文件所在目录
  console.log('__filename :', __filename); // 当前文件绝对路径

  // 铁证：若是全局变量，globalThis 上应能找到 -- 实际 undefined
  console.log('globalThis.__dirname :', (globalThis as { __dirname?: string }).__dirname);

  // require：CommonJS 的模块加载函数（内置模块推荐加 node: 前缀）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require('node:os') as typeof import('node:os');
  console.log('require 加载 os 模块，CPU 核心数:', os.cpus().length);

  // exports 是 module.exports 的快捷引用（指向同一对象）
  console.log('exports === module.exports :', exports === module.exports); // true
}

demo2Main();
