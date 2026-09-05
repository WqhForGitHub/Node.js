/**
 * child_process — 创建子进程执行外部命令
 * exec/execFile：等命令跑完，一次性拿到全部输出（适合小命令）
 * spawn       ：流式接收输出（适合大输出、长时间任务，如 npm run dev）
 * fork        ：专门启动 Node 子进程，自带进程间通信（IPC）
 */
import { exec, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec); // 回调风格 -> Promise 风格
const execFileAsync = promisify(execFile);

// ---------- 1. exec：经过 shell 解释，支持管道等语法 ----------
// 注意：命令串里拼用户输入会有注入风险
exec('echo hello-from-shell', (_err, stdout) => {
  console.log('exec 输出    :', stdout.trim());
});

// ---------- 2. execFile：不走 shell，参数走数组，更安全 ----------
execFile('node', ['-e', "console.log('execFile: 来自子进程')"], (_err, stdout) => {
  console.log('execFile 输出:', stdout.trim());
});

// ---------- 3. spawn：流式逐块拿输出 ----------
const child = spawn('node', [
  '-e',
  "for (let i = 1; i <= 3; i++) console.log('spawn 第 ' + i + ' 行')",
]);
child.stdout.on('data', (chunk) => process.stdout.write(`[spawn] ${chunk}`));
child.stderr.on('data', (chunk) => console.error(`[spawn 错误] ${chunk}`));
child.on('close', (code) => console.log(`spawn 子进程退出，退出码 = ${code}`));

// ---------- 4. Promise 风格：配合 async/await 最舒服 ----------
async function main() {
  const { stdout } = await execAsync('node --version');
  console.log('\nasync 拿版本号:', stdout.trim());

  const r = await execFileAsync('node', ['-e', "console.log('calc:', 1 + 1)"]);
  console.log('execFile stdout:', r.stdout.trim());
}

main();
