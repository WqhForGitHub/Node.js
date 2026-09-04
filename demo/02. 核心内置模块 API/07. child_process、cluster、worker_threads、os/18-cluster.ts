/**
 * Demo 18 - cluster 模块（多进程共享同一端口，榨干多核 CPU）
 * 运行：node "demo/02. 核心内置模块 API/07. child_process、cluster、worker_threads、os/18-cluster.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cluster = require('node:cluster') as typeof import('node:cluster');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = require('node:http') as typeof import('node:http');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os') as typeof import('node:os');

const N = Math.min(os.cpus().length, 4); // worker 数量
const PORT = 8000;

if (cluster.isPrimary) {
  // ===== 主进程：只负责 fork 和守护 =====
  console.log(`1. 主进程 ${process.pid} 启动，fork ${N} 个 worker`);

  for (let i = 0; i < N; i++) cluster.fork();

  // worker 挂掉时触发（生产环境常在这里再 fork 一个守护）
  cluster.on('exit', (worker, code) => {
    console.log(`4. worker ${worker.process.pid} 退出（code=${code}）`);
  });

  // 发几个请求，观察它们被分给不同 worker
  setTimeout(() => {
    console.log('3. 发起请求测试：');
    let done = 0;
    for (let i = 0; i < N; i++) {
      http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.setEncoding('utf8');
        res.on('data', (body) => console.log(`   ${body}`));
        res.on('end', () => {
          if (++done === N) cluster.disconnect(); // 优雅关闭全部 worker
        });
      });
    }
  }, 500);
} else {
  // ===== 工作进程：真正的 HTTP 服务 =====
  // 端口由主进程持有，连接再分发给 worker，所以互不冲突
  http
    .createServer((req, res) => {
      res.end(`请求由 worker ${process.pid} 处理`);
    })
    .listen(PORT, () => console.log(`2. worker ${process.pid} 监听 :${PORT}`));
}
