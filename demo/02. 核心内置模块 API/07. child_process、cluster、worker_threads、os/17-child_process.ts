/**
 * Demo 17 - child_process 模块（exec / spawn / fork 创建子进程）
 * 运行：node "demo/02. 核心内置模块 API/07. child_process、cluster、worker_threads、os/17-child_process.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const child_process = require('node:child_process') as typeof import('node:child_process');
const { execFile, exec, spawn, execSync, fork } = child_process;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { promisify } = require('node:util') as typeof import('node:util');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { once } = require('node:events') as typeof import('node:events');

const execFileP = promisify(execFile); // promise 化，返回 { stdout, stderr }

async function main(): Promise<void> {
  // 1. execFile：文件 + 参数数组，不经 shell，跑完一次性返回全部输出
  const { stdout } = await execFileP(process.execPath, ['--version']);
  console.log(`1. execFile node --version → ${stdout.trim()}`);

  // 2. exec：整条命令交给 shell，支持 &&、管道等语法
  const r = await promisify(exec)('echo A && echo B');
  console.log(`2. exec "echo A && echo B" → ${r.stdout.trim().replace(/\r?\n/g, ' / ')}`);

  // 3. spawn：流式输出，适合大量输出/长任务
  const count = spawn(process.execPath, ['-e', 'console.log("第 1 行"); console.log("第 2 行")']);
  count.stdout.on('data', (chunk) => process.stdout.write(`3. spawn 流式输出: ${chunk}`));
  await once(count, 'close'); // close = 进程结束且流已关闭

  // 4. 双向通信：写子进程 stdin，它回显回来
  const echo = spawn(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)']);
  echo.stdout.on('data', (chunk) => console.log(`4. 子进程回显: ${chunk.toString().trim()}`));
  echo.stdin.write('hello stdin\n');
  echo.stdin.end(); // 写完关闭，子进程随之结束
  await once(echo, 'close');

  // 5. execSync：同步阻塞执行，慎用
  const ver = execSync('node --version').toString().trim();
  console.log(`5. execSync → ${ver}`);

  // 6. fork：spawn 特例，专跑 Node 脚本并建立 IPC 通道；这里 fork 本文件，走底部子进程分支
  const child = fork(__filename);
  child.send('ping'); // 父 → 子
  child.on('message', (msg: string) => {
    console.log(`6. 父进程收到: ${msg}`);
    child.disconnect(); // 关闭 IPC，子进程退出
  });
  await once(child, 'exit');
  console.log('6. fork 子进程已退出，演示结束');
}

// fork 出来的子进程走这里（process.send 仅带 IPC 通道的子进程存在）
if (process.send) {
  process.on('message', (msg: string) => {
    console.log(`6. 子进程收到: ${msg}`);
    process.send?.(`pong（来自子进程 ${process.pid}）`); // 子 → 父
  });
  process.on('disconnect', () => process.exit(0));
} else {
  main();
}
