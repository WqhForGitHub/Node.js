/**
 * BFF 聚合层 - 一键启动脚本
 *
 * 按顺序启动：
 *   1. 用户服务 (port 5001)
 *   2. 订单服务 (port 5002)
 *   3. 商品服务 (port 5003)
 *   4. 库存服务 (port 5004)
 *   5. BFF 聚合层服务器 (port 8080)
 *
 * 使用方式:
 *   node start.js
 */

const { spawn } = require("child_process");
const path = require("path");

const services = [
  {
    name: "用户服务",
    script: path.join(__dirname, "services", "user-service.js"),
    port: 5001,
    delay: 500,
  },
  {
    name: "订单服务",
    script: path.join(__dirname, "services", "order-service.js"),
    port: 5002,
    delay: 500,
  },
  {
    name: "商品服务",
    script: path.join(__dirname, "services", "product-service.js"),
    port: 5003,
    delay: 500,
  },
  {
    name: "库存服务",
    script: path.join(__dirname, "services", "inventory-service.js"),
    port: 5004,
    delay: 500,
  },
  {
    name: "BFF 聚合层",
    script: path.join(__dirname, "bff-server.js"),
    port: 8080,
    delay: 1000,
  },
];

const processes = [];

console.log("╔══════════════════════════════════════════════════╗");
console.log("║       API 聚合层（BFF）- 启动中...              ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log();

function startService(index) {
  if (index >= services.length) {
    console.log();
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║         所有服务已启动完成！                    ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║                                                  ║");
    console.log("║  BFF 聚合层:  http://127.0.0.1:8080             ║");
    console.log("║                                                  ║");
    console.log("║  后端微服务:                                     ║");
    console.log("║    用户服务:  http://127.0.0.1:5001             ║");
    console.log("║    订单服务:  http://127.0.0.1:5002             ║");
    console.log("║    商品服务:  http://127.0.0.1:5003             ║");
    console.log("║    库存服务:  http://127.0.0.1:5004             ║");
    console.log("║                                                  ║");
    console.log("║  测试示例:                                       ║");
    console.log("║  curl http://127.0.0.1:8080/health              ║");
    console.log("║  curl http://127.0.0.1:8080/web/homepage        ║");
    console.log("║  curl http://127.0.0.1:8080/mobile/homepage     ║");
    console.log("║  curl http://127.0.0.1:8080/web/dashboard/u001  ║");
    console.log("║  curl http://127.0.0.1:8080/web/orders/o001     ║");
    console.log("║  curl http://127.0.0.1:8080/web/products/p001   ║");
    console.log("║                                                  ║");
    console.log("║  按 Ctrl+C 停止所有服务                         ║");
    console.log("╚══════════════════════════════════════════════════╝");
    return;
  }

  const service = services[index];
  console.log(
    `[启动 ${index + 1}/${services.length}] ${service.name} (port ${service.port})...`,
  );

  const proc = spawn(process.execPath, [service.script], {
    cwd: __dirname,
    stdio: "pipe",
    env: { ...process.env },
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      console.log(`  [${service.name}] ${line}`);
    });
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      console.error(`  [${service.name}] ${line}`);
    });
  });

  proc.on("close", (code) => {
    console.log(`  [${service.name}] 已退出 (code: ${code})`);
  });

  processes.push({ name: service.name, proc });

  setTimeout(() => startService(index + 1), service.delay);
}

// 优雅关闭
function shutdown() {
  console.log("\n正在停止所有服务...");
  processes.forEach(({ name, proc }) => {
    console.log(`  停止 ${name}...`);
    proc.kill("SIGTERM");
  });

  setTimeout(() => {
    console.log("所有服务已停止");
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 启动第一个服务
startService(0);
