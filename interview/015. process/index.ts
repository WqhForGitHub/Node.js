/**
 * Node.js process 对象完整示例
 * 运行命令: node process-demo.js 100 hello --env=test
 */

// 1. process.argv 命令行参数
console.log('=== process.argv 命令行参数 ===');
console.log(process.argv);

// 2. process.env 环境变量
console.log('\n=== process.env 环境变量 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
// 设置环境变量
process.env.NODE_ENV = 'development';
console.log('修改后 NODE_ENV:', process.env.NODE_ENV);

// 3. process.platform 操作系统平台
console.log('\n=== process.platform 平台 ===');
console.log('运行平台:', process.platform); // win32 / linux / darwin

// 4. process.version node版本
console.log('\n=== process.version ===');
console.log('Node版本:', process.version);

// 5. process.versions 全部组件版本
console.log('\n=== process.versions ===');
console.log(process.versions);

// 6. process.pid 当前进程id
console.log('\n=== process.pid / ppid ===');
console.log('当前进程pid:', process.pid);
console.log('父进程ppid:', process.ppid);

// 7. process.cwd() 当前工作目录（方法）
console.log('\n=== process.cwd() 当前工作目录 ===');
console.log('cwd:', process.cwd());
console.log('__dirname 脚本所在目录:', __dirname);

// 8. stdout 标准输出流
console.log('\n=== process.stdout 标准输出 ===');
process.stdout.write('使用 process.stdout.write 输出文字\n');

// ========== 进程事件监听 ==========
// exit 事件：进程退出时触发
process.on('exit', (code) => {
  console.log('\n>>> 进程即将退出，退出码：', code);
});

// uncaughtException 捕获未处理异常
process.on('uncaughtException', (err) => {
  console.log('\n>>> 捕获到未处理异常：', err.message);
});

// 模拟异常，打开下面注释可以测试
// throw new Error("模拟一个错误");

console.log('\n全部信息打印完成');

// 调用 process.exit(0); // 主动正常退出，会触发 exit 事件
