/**
 * Cluster 多进程 HTTP 服务器
 *
 * 使用 cluster 模块，按 CPU 核心数启动多个工作进程共同监听同一端口。
 * 工作进程退出后 主进程 自动 fork 新的进程维持工作进程数量。
 *
 * 运行：npx ts-node server.ts 3000
 */
import * as cluster from 'cluster';
import * as os from 'os';
import * as http from 'http';

const port = parseInt(process.argv[2] || '3000', 10);

if (cluster.isPrimary) {
  const num = Math.min(4, os.cpus().length);
  console.log(`主进程 pid=${process.pid}，启动 ${num} 个 worker`);
  for (let i = 0; i < num; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} 退出 (code=${code} signal=${signal})，重启中`);
    cluster.fork();
  });

  cluster.on('online', (w) => console.log(`worker ${w.process.pid} 上线`));
} else {
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          pid: process.pid,
          url: req.url,
          time: new Date().toISOString(),
        })
      );
    })
    .listen(port, () => {
      console.log(`worker pid=${process.pid} 监听 :${port}`);
    });
}
