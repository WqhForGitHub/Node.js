/**
 * 微服务架构平台 - 启动脚本
 *
 * 一键启动所有服务：
 *   1. 服务注册中心 (port 4000)
 *   2. 用户服务 (port 3001)
 *   3. 订单服务 (port 3002)
 *   4. 产品服务 (port 3003)
 *   5. API 网关 (port 8080)
 *
 * 使用方式:
 *   node start.js
 */

const { spawn } = require('child_process');
const path = require('path');

// 服务配置列表
const services = [
  {
    name: '服务注册中心',
    script: path.join(__dirname, 'service-registry.js'),
    port: 4000,
    delay: 500, // 启动后延迟（ms），让注册中心先就绪
  },
  {
    name: '用户服务',
    script: path.join(__dirname, 'services', 'user-service.js'),
    port: 3001,
    delay: 1500,
  },
  {
    name: '订单服务',
    script: path.join(__dirname, 'services', 'order-service.js'),
    port: 3002,
    delay: 1500,
  },
  {
    name: '产品服务',
    script: path.join(__dirname, 'services', 'product-service.js'),
    port: 3003,
    delay: 1500,
  },
  {
    name: 'API 网关',
    script: path.join(__dirname, 'api-gateway.js'),
    port: 8080,
    delay: 2000,
  },
];

const processes = [];
const currentStep = 0;

console.log('╔══════════════════════════════════════════════════╗');
console.log('║         微服务架构平台 - 启动中...              ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log();

function startService(index) {
  if (index >= services.length) {
    console.log();
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║         所有服务已启动完成！                    ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║                                                  ║');
    console.log('║  API 网关:    http://127.0.0.1:8080              ║');
    console.log('║  注册中心:    http://127.0.0.1:4000              ║');
    console.log('║  用户服务:    http://127.0.0.1:3001              ║');
    console.log('║  订单服务:    http://127.0.0.1:3002              ║');
    console.log('║  产品服务:    http://127.0.0.1:3003              ║');
    console.log('║                                                  ║');
    console.log('║  按 Ctrl+C 停止所有服务                         ║');
    console.log('╚══════════════════════════════════════════════════╝');
    return;
  }

  const service = services[index];
  console.log(`[启动 ${index + 1}/${services.length}] ${service.name} (port ${service.port})...`);

  const proc = spawn(process.execPath, [service.script], {
    cwd: __dirname,
    stdio: 'pipe',
    env: {
      ...process.env,
      REGISTRY_HOST: '127.0.0.1',
      REGISTRY_PORT: '4000',
    },
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.log(`  [${service.name}] ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.error(`  [${service.name}] ${line}`);
    });
  });

  proc.on('close', (code) => {
    console.log(`  [${service.name}] 已退出 (code: ${code})`);
  });

  processes.push({ name: service.name, proc });

  // 延迟后启动下一个服务
  setTimeout(() => startService(index + 1), service.delay);
}

// 优雅关闭
function shutdown() {
  console.log('\n正在停止所有服务...');
  processes.forEach(({ name, proc }) => {
    console.log(`  停止 ${name}...`);
    proc.kill('SIGTERM');
  });

  setTimeout(() => {
    console.log('所有服务已停止');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 启动第一个服务
startService(0);
