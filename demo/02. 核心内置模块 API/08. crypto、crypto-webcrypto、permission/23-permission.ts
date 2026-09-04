/**
 * Demo 23 - permission 模块（权限模型：限制 文件读写 / 子进程 / worker 线程）
 * 运行：node --permission "demo/02. 核心内置模块 API/08. crypto、crypto-webcrypto、permission/23-permission.ts"（不加 --permission 则不启用）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os') as typeof import('node:os');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');

function main(): void {
  const permission = process.permission; // --permission 启动时才存在

  // 1. 未启用权限模型
  if (!permission) {
    console.log('1. 权限模型未启用，请改用 node --permission 运行本文件体验');
    return;
  }

  // 2. has(scope)：查询整类权限（默认全部拒绝）
  console.log(
    `2. 子进程=${permission.has('child')}  worker=${permission.has('worker')}  写文件=${permission.has('fs.write')}`
  );

  // 3. has(scope, path)：查询具体路径（入口文件自动放行）
  console.log(
    `3. 读自身=${permission.has('fs.read', __filename)}  读临时目录=${permission.has('fs.read', os.tmpdir())}`
  );

  // 4. 被拒效果：抛 ERR_ACCESS_DENIED
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'demo23.txt'), 'hi');
    console.log('4. 写临时目录成功（说明已通过 --allow-fs-write 授权）');
  } catch (err) {
    console.log(`4. 写临时目录被拒：${(err as NodeJS.ErrnoException).code}`);
  }
}

main();
