/**
 * Demo 1 - 全局函数
 * 运行：node "demo/01. 全局 API/1-global-functions.ts"（Node 22.18+）
 */

// 无 import/export 时 TS 视为全局脚本，加前缀避免与其它 demo 冲突
async function demo1Main(): Promise<void> {
  // 1. 执行顺序：同步 -> 微任务 -> setImmediate / setTimeout
  console.log('=== 1. 执行顺序 ===');
  console.log('[sync] 1');

  queueMicrotask(() => console.log('[micro] 3')); // 微任务，先于所有定时器
  setImmediate(() => console.log('setImmediate 4')); // 下一轮循环的 check 阶段
  setTimeout(() => console.log('setTimeout 5'), 0); // 0 被强制改为至少 1ms

  console.log('[sync] 2'); // 同步代码全部结束后微任务才开始
  await new Promise<void>((resolve) => setTimeout(resolve, 20)); // 等回调跑完

  // 2. 清除定时器
  console.log('\n=== 2. 清除定时器 ===');

  clearTimeout(setTimeout(() => console.log('不会执行'), 100));
  clearImmediate(setImmediate(() => console.log('不会执行')));
  console.log('已取消，两个回调都不会触发');

  await new Promise<void>((resolve) => {
    let count = 0;
    const timer = setInterval(() => {
      console.log(`setInterval 第 ${++count} 次`);
      if (count === 3) {
        clearInterval(timer); // 不 clear 进程不会退出
        resolve();
      }
    }, 300);
  });

  // 3. fetch：返回的只是响应头，响应体需再 await res.json()
  console.log('\n=== 3. fetch ===');

  try {
    const res = await fetch('https://nodejs.org/dist/index.json', {
      signal: AbortSignal.timeout(8000), // 超时自动中止
    });
    const versions = (await res.json()) as Array<{ version: string }>;
    console.log('状态:', res.status, '| 最新 Node 版本:', versions[0]?.version);
  } catch (err) {
    console.log('请求失败:', (err as Error).name, '-', (err as Error).message); // 断网/超时
  }

  // 4. structuredClone：深拷贝，支持 Date / Map / Set（JSON 方式不支持）
  console.log('\n=== 4. structuredClone ===');

  const original = { createdAt: new Date('2010-01-01'), tags: new Set(['js']), list: [1, 2, 3] };
  const copy = structuredClone(original);

  copy.list.push(4); // 改拷贝不影响原对象
  copy.tags.add('server');

  console.log('原 :', original.list, [...original.tags]);
  console.log('拷贝:', copy.list, [...copy.tags]);
  console.log('Date 不共享引用:', copy.createdAt !== original.createdAt); // true
  // structuredClone(() => {}); // ❌ 函数无法克隆，抛 DataCloneError

  // 5. btoa / atob：Base64 编解码，仅支持 Latin1
  console.log('\n=== 5. btoa / atob ===');

  const encoded = btoa('Hello, Node.js!');
  console.log('编码:', encoded, '| 解码:', atob(encoded));

  // 中文会抛 InvalidCharacterError，需经 Buffer
  // btoa('你好'); // ❌
  const cn = Buffer.from('你好', 'utf8').toString('base64');
  console.log('中文走 Buffer:', cn, '->', Buffer.from(cn, 'base64').toString('utf8'));
}

demo1Main();
