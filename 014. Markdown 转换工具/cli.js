#!/usr/bin/env node

/**
 * Markdown 转换工具 CLI
 *
 * 用法:
 *   node cli.js md2html <input.md> [-o output.html] [-t "标题"] [--full]
 *   node cli.js html2md  <input.html> [-o output.md]
 *   node cli.js --help
 *
 * 选项:
 *   -o, --output <file>   输出文件路径（默认输出到控制台）
 *   -t, --title <title>   HTML 文档标题（仅 md2html，默认 "Markdown Document"）
 *   --full                输出完整 HTML 文档（含 <html><head>...）（仅 md2html）
 *   -h, --help            显示帮助信息
 */

'use strict';

const fs = require('fs');
const path = require('path');
const md2html = require('./lib/md2html');
const html2md = require('./lib/html2md');

// ============================================================
// 参数解析
// ============================================================

function parseArgs(argv) {
  const args = {
    command: null,
    input: null,
    output: null,
    title: 'Markdown Document',
    full: false,
  };

  const rest = argv.slice(2);

  if (rest.length === 0 || rest.includes('-h') || rest.includes('--help')) {
    return { ...args, help: true };
  }

  args.command = rest[0];

  if (args.command !== 'md2html' && args.command !== 'html2md') {
    // 如果不是命令，当作 md2html 的输入文件
    args.input = args.command;
    args.command = 'md2html';
  } else {
    if (rest.length < 2) {
      console.error('错误: 请指定输入文件');
      process.exit(1);
    }
    args.input = rest[1];
  }

  for (let i = 0; i < rest.length; i++) {
    if ((rest[i] === '-o' || rest[i] === '--output') && rest[i + 1]) {
      args.output = rest[++i];
    }
    if ((rest[i] === '-t' || rest[i] === '--title') && rest[i + 1]) {
      args.title = rest[++i];
    }
    if (rest[i] === '--full') {
      args.full = true;
    }
  }

  return args;
}

// ============================================================
// 帮助信息
// ============================================================

function printHelp() {
  console.log(`
Markdown 转换工具 - 纯 Node.js 实现
=====================================

用法:
  node cli.js md2html <input.md>  [-o output.html] [-t "标题"] [--full]
  node cli.js html2md  <input.html> [-o output.md]
  node cli.js <input.md>           (简写，等同于 md2html)

命令:
  md2html    将 Markdown 文件转换为 HTML
  html2md    将 HTML 文件转换为 Markdown

选项:
  -o, --output <file>   输出文件路径（默认输出到控制台）
  -t, --title <title>   HTML 文档标题（仅 md2html，默认 "Markdown Document"）
  --full                输出完整 HTML 文档（含 <html><head>...）（仅 md2html）
  -h, --help            显示帮助信息

示例:
  node cli.js md2html readme.md -o readme.html --full
  node cli.js md2html readme.md -o readme.html -t "我的文档"
  node cli.js html2md page.html -o page.md
  node cli.js readme.md          (快速转换，输出到控制台)
`);
}

// ============================================================
// 主函数
// ============================================================

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 检查输入文件
  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 文件不存在 - ${inputPath}`);
    process.exit(1);
  }

  const inputContent = fs.readFileSync(inputPath, 'utf-8');
  let result;

  if (args.command === 'md2html') {
    if (args.full) {
      result = md2html.convertToFullHtml(inputContent, { title: args.title });
    } else {
      result = md2html.convert(inputContent);
    }
  } else if (args.command === 'html2md') {
    result = html2md.convert(inputContent);
  }

  // 输出
  if (args.output) {
    const outputPath = path.resolve(args.output);
    fs.writeFileSync(outputPath, result, 'utf-8');
    console.log(`已输出到: ${outputPath}`);
  } else {
    console.log(result);
  }
}

main();
