/**
 * Demo 9 - tty 终端（isatty 判断 / 尺寸 / 颜色 / 原始模式）
 * 运行：node "demo/02. 核心内置模块 API/04. stream、readline、tty/9. tty.ts"（Node 22.18+）
 * 提示：需在终端运行；管道/重定向时 isTTY 为 undefined
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tty = require('node:tty') as typeof import('node:tty');

function main(): void {
  // 1. isatty(fd)：fd 是否连接终端（0/1/2 = stdin/stdout/stderr）
  console.log('1. isatty(0/1/2):', tty.isatty(0), tty.isatty(1), tty.isatty(2));

  // 2. 终端下 stdin/stdout 即 tty.ReadStream / WriteStream 实例
  console.log(
    '2. stdin 类型:',
    process.stdin.constructor.name,
    '| stdout 类型:',
    process.stdout.constructor.name
  );
  console.log('   stdout.isTTY:', process.stdout.isTTY, '（非终端时为 undefined）');

  // 3. 尺寸 columns × rows，变化触发 'resize'
  console.log('3. 尺寸:', process.stdout.columns, '×', process.stdout.rows);
  process.stdout.on('resize', () => {
    console.log('3. resize →', process.stdout.columns, '×', process.stdout.rows);
  });

  // 4. 颜色：getColorDepth 等只在 TTY 上存在
  if (process.stdout.isTTY) {
    console.log('4. 颜色深度:', process.stdout.getColorDepth(), '位'); // 1=黑白 4=16色 8=256色 24=真彩色
    console.log('   \x1b[31m红\x1b[32m绿\x1b[34m蓝\x1b[0m \x1b[1m加粗\x1b[0m \x1b[3m斜体\x1b[0m');
  } else {
    console.log('4. 非终端：无颜色信息');
  }

  // 5. setRawMode：按键立即可读、不回显（快捷键监听原理）
  if (process.stdin.isTTY) {
    console.log('5. 原始模式已开启：按 q 或 Ctrl+C 退出');
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf-8');
    process.stdin.resume();
    process.stdin.on('data', (key: string) => {
      process.stdout.write(`5. 按键: ${JSON.stringify(key)}\r\n`); // 原始模式下 \n 不回行首，要 \r\n
      if (key === 'q' || key === '\u0003') {
        process.stdin.setRawMode(false);
        process.exit(0); // 恢复终端后退出
      }
    });
  } else {
    console.log('5. stdin 不是终端，跳过原始模式演示');
  }
}

main();
