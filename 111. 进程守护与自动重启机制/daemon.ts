/**
 * 进程守护与自动重启机制（类似简易 pm2）
 *
 *守护进程监视被托管脚本，发生异常退出或主动监视时自动重启，
 * 限制最大重启次数，超过则放弃。
 *
 * 用法：作为守护脚本，被守护内容直接写在同文件 child() 函数中。
 * 启动：npx ts-node daemon.ts
 */
import * as child_process from 'child_process';
import * as path from 'path';

const MAX_RESTART = 5;
const COOL_DOWN_MS = 1000;

function spawnChild(): child_process.ChildProcess {
  // 用子进程执行 child() 分支（通过环境变量标识）
  return child_process.fork(__filename, [], { env: { ...process.env, CHILD: '1' } });
}

function startSupervisor() {
  let restarts = 0;
  let child = spawnChild();
  console.log(`[守护] 启动子进程 pid=${child.pid}`);

  child.on('exit', (code, signal) => {
    console.log(`[守护] 子进程退出 code=${code} signal=${signal}`);
    if (code === 0) {
      console.log('[守护] 正常结束');
      return;
    }
    if (restarts >= MAX_RESTART) {
      console.error(`[守护] 已超过最大重启次数 ${MAX_RESTART}，放弃`);
      process.exit(1);
    }
    restarts++;
    console.log(`[守护] ${COOL_DOWN_MS}ms 后重启 (${restarts}/${MAX_RESTART})`);
    setTimeout(() => {
      child = spawnChild();
      console.log(`[守护] 重新启动子进程 pid=${child.pid}`);
      bind();
    }, COOL_DOWN_MS);
  });

  function bind() {
    child.on('exit', () => {
      /* 由上面 setTimeout 段处理 */
    });
  }
  child.on('error', (err) => console.error('[守护] 子进程错误', err));
}

function runChild() {
  // 被守护的"业务进程"，随机崩溃或正常退出
  const live = 2000 + Math.floor(Math.random() * 4000);
  console.log(`[子] 业务启动 pid=${process.pid}，将运行 ${live}ms`);
  setTimeout(() => {
    // 模拟 70% 概率崩溃
    if (Math.random() < 0.7) {
      console.log('[子] 模拟崩溃');
      process.exit(1);
    } else {
      console.log('[子] 正常结束');
      process.exit(0);
    }
  }, live);
}

if (process.env.CHILD === '1') {
  runChild();
} else {
  startSupervisor();
}
