/**
 * Demo 20 - os 模块（平台 / CPU / 内存 / 网络接口 / 常用目录）
 * 运行：node "demo/02. 核心内置模块 API/07. child_process、cluster、worker_threads、os/20-os.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os') as typeof import('node:os');

function main(): void {
  // 1. 平台与架构
  console.log(`1. platform=${os.platform()}  arch=${os.arch()}  hostname=${os.hostname()}`);

  // 2. CPU：cpus() 每个逻辑核一项
  const cpus = os.cpus();
  console.log(`2. 逻辑核数=${cpus.length}  型号=${cpus[0]?.model.trim()}`);

  // 3. 内存：单位为字节
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)}GB`;
  console.log(`3. 总内存=${gb(os.totalmem())}  空闲=${gb(os.freemem())}`);

  // 4. 系统状态
  console.log(
    `4. 系统已运行 ${Math.floor(os.uptime() / 3600)} 小时  当前用户=${os.userInfo().username}`
  );

  // 5. 网络接口：取每块网卡的 IPv4 地址
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    const ipv4 = addrs?.find((a) => a.family === 'IPv4');
    if (ipv4) console.log(`5. 网卡 ${name}: ${ipv4.address}`);
  }

  // 6. 常用目录
  console.log(`6. 主目录=${os.homedir()}  临时目录=${os.tmpdir()}`);

  // 7. 换行符：Windows 为 \r\n，Linux/macOS 为 \n
  console.log(`7. 换行符 EOL=${JSON.stringify(os.EOL)}`);
}

main();
