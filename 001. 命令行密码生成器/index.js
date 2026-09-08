#!/usr/bin/env node
/**
 * 命令行密码生成器
 * 纯 Node.js 实现，无第三方依赖
 *
 * 使用方法：
 *   node index.js [选项]
 *   node index.js -i              交互模式
 *   node index.js -l 16 -s -n -u  生成 16 位强密码
 *   node index.js -c 5            生成 5 个密码
 *   node index.js -h              查看帮助
 */
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { generatePassword, generateBatch, evaluateStrength } = require('./generator');

// ANSI 颜色码
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function color(text, c) {
  return `${COLORS[c] || ''}${text}${COLORS.reset}`;
}

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    length: 12,
    count: 1,
    lowercase: false,
    uppercase: false,
    numbers: false,
    symbols: false,
    excludeSimilar: false,
    interactive: false,
    help: false,
    save: null,
  };

  // 若未显式指定任何字符类型，默认开启小写+大写+数字
  let charTypeSpecified = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-l':
      case '--length':
        options.length = parseInt(args[++i], 10);
        break;
      case '-c':
      case '--count':
        options.count = parseInt(args[++i], 10);
        break;
      case '-L':
      case '--lower':
        options.lowercase = true;
        charTypeSpecified = true;
        break;
      case '-u':
      case '--upper':
        options.uppercase = true;
        charTypeSpecified = true;
        break;
      case '-n':
      case '--number':
        options.numbers = true;
        charTypeSpecified = true;
        break;
      case '-s':
      case '--symbol':
        options.symbols = true;
        charTypeSpecified = true;
        break;
      case '-e':
      case '--exclude-similar':
        options.excludeSimilar = true;
        break;
      case '-i':
      case '--interactive':
        options.interactive = true;
        break;
      case '-o':
      case '--output':
        options.save = args[++i];
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        console.error(color(`未知参数: ${arg}`, 'red'));
        options.help = true;
    }
  }

  // 默认字符集
  if (!charTypeSpecified) {
    options.lowercase = true;
    options.uppercase = true;
    options.numbers = true;
  }

  return options;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
${color('命令行密码生成器', 'bold')} - 纯 Node.js 实现

${color('用法:', 'cyan')}
  node index.js [选项]

${color('选项:', 'cyan')}
  -l, --length <n>        密码长度（默认 12）
  -c, --count <n>         生成数量（默认 1）
  -L, --lower             包含小写字母
  -u, --upper             包含大写字母
  -n, --number            包含数字
  -s, --symbol            包含特殊符号
  -e, --exclude-similar   排除易混淆字符 (il1Lo0O)
  -i, --interactive       交互模式
  -o, --output <file>     将密码保存到文件
  -h, --help              显示此帮助信息

${color('默认行为:', 'cyan')}
  未指定字符类型时，默认启用 小写+大写+数字

${color('示例:', 'cyan')}
  node index.js                       # 生成 12 位默认密码
  node index.js -l 20 -s              # 生成 20 位含符号密码
  node index.js -c 10 -l 16 -s -n -u  # 批量生成 10 个 16 位强密码
  node index.js -i                    # 交互式生成
  node index.js -l 16 -s -o pass.txt  # 保存到文件
`);
}

/**
 * 打印密码及强度信息
 */
function printPassword(password, index = null) {
  const strength = evaluateStrength(password);
  const levelColors = { 弱: 'red', 中: 'yellow', 强: 'green', 极强: 'cyan' };
  const levelColor = levelColors[strength.level] || 'reset';

  const prefix = index !== null ? color(`[${index + 1}] `, 'gray') : '';
  console.log(
    `${prefix}${color(password, 'bold')}  ` +
      `${color(`[${strength.level}]`, levelColor)} ` +
      color(`长度: ${strength.length}, 熵值: ${strength.entropy} bits`, 'gray')
  );
}

/**
 * 交互模式
 */
function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  (async () => {
    console.log(color('\n=== 交互式密码生成器 ===\n', 'bold'));

    const lengthInput = await question(color('密码长度 (默认 12): ', 'cyan'));
    const length = parseInt(lengthInput, 10) || 12;

    const countInput = await question(color('生成数量 (默认 1): ', 'cyan'));
    const count = parseInt(countInput, 10) || 1;

    const lower = (await question(color('包含小写字母? (Y/n): ', 'cyan'))).toLowerCase() !== 'n';
    const upper = (await question(color('包含大写字母? (Y/n): ', 'cyan'))).toLowerCase() !== 'n';
    const number = (await question(color('包含数字? (Y/n): ', 'cyan'))).toLowerCase() !== 'n';
    const symbol = (await question(color('包含特殊符号? (y/N): ', 'cyan'))).toLowerCase() === 'y';
    const excludeSim =
      (await question(color('排除易混淆字符? (y/N): ', 'cyan'))).toLowerCase() === 'y';

    rl.close();

    const opts = {
      length,
      lowercase: lower,
      uppercase: upper,
      numbers: number,
      symbols: symbol,
      excludeSimilar: excludeSim,
    };

    try {
      console.log(color('\n--- 生成结果 ---', 'green'));
      const passwords = generateBatch(opts, count);
      passwords.forEach((p, i) => printPassword(p, count > 1 ? i : null));
      console.log();
    } catch (err) {
      console.error(color(`错误: ${err.message}`, 'red'));
      process.exit(1);
    }
  })();
}

/**
 * 主流程
 */
function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.interactive) {
    runInteractive();
    return;
  }

  try {
    const passwords = generateBatch(options, options.count);

    console.log(color('\n--- 生成结果 ---', 'green'));
    passwords.forEach((p, i) => printPassword(p, options.count > 1 ? i : null));
    console.log();

    if (options.save) {
      const filePath = path.resolve(options.save);
      fs.writeFileSync(filePath, passwords.join('\n') + '\n', 'utf8');
      console.log(color(`已保存到: ${filePath}`, 'green'));
    }
  } catch (err) {
    console.error(color(`错误: ${err.message}`, 'red'));
    console.error(color('使用 -h 查看帮助', 'gray'));
    process.exit(1);
  }
}

main();
