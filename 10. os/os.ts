/**
 * os — 获取系统与硬件信息
 */
import os from "node:os";

// ---------- 1. 系统基础信息 ----------
console.log("系统类型 :", os.type());      // Windows_NT / Linux / Darwin
console.log("平台     :", os.platform());  // win32 / linux / darwin
console.log("架构     :", os.arch());      // x64 / arm64
console.log("主机名   :", os.hostname());
console.log("用户目录 :", os.homedir());   // C:\Users\xxx
console.log("临时目录 :", os.tmpdir());
console.log("开机至今 :", (os.uptime() / 60).toFixed(0), "分钟");

// ---------- 2. CPU ----------
const cpus = os.cpus();
console.log("\nCPU 核数 :", cpus.length);
console.log("CPU 型号 :", cpus[0]?.model);
console.log("并行度   :", os.availableParallelism()); // 建议的线程池大小

// ---------- 3. 内存 ----------
const gb = (n: number) => (n / 1024 ** 3).toFixed(1) + " GB";
console.log("\n总内存   :", gb(os.totalmem()));
console.log("空闲内存 :", gb(os.freemem()));

// ---------- 4. 网卡信息（过滤回环，只看 IPv4） ----------
console.log("\n网络接口:");
for (const [name, list] of Object.entries(os.networkInterfaces())) {
  for (const net of list ?? []) {
    if (!net.internal && net.family === "IPv4") {
      console.log(`  ${name}: ${net.address}`);
    }
  }
}

// ---------- 5. 换行符：跨平台写文件必知 ----------
// Windows 是 \r\n，Linux/macOS 是 \n
console.log("\nEOL:", JSON.stringify(os.EOL));
