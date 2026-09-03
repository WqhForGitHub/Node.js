/**
 * 005 - 什么是 npm？如何使用它来管理项目的依赖？
 *
 * npm（Node Package Manager）是 Node.js 官方的包管理器，
 * 用于安装、卸载、更新第三方包，以及运行 package.json 中定义的脚本。
 *
 * 本文件用 child_process 调用 npm 命令，演示常用的 npm 能力。
 */

import { execSync } from 'node:child_process';

/** 执行 shell 命令并返回输出（execSync 是同步阻塞的，适合脚本类任务） */
function run(cmd: string): string {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

// ============================================================
// 1. 查看 npm 环境信息
// ============================================================
console.log('=== 1. npm 环境信息 ===');
console.log('npm 版本: ', run('npm --version'));
console.log('npm 源:   ', run('npm config get registry'));

// ============================================================
// 2. 常用命令速查（以注释形式展示，可直接复制使用）
// ============================================================
console.log('\n=== 2. 常用命令速查 ===');
console.log(`
npm init / npm init -y          # 初始化项目，生成 package.json
npm install                     # 安装 package.json 中所有依赖
npm install <包名>               # 安装并写入 dependencies（生产依赖）
npm install -D <包名>            # 安装并写入 devDependencies（开发依赖）
npm install <包名>@1.2.3         # 安装指定版本
npm uninstall <包名>             # 卸载依赖
npm update <包名>                # 更新依赖（在语义化版本范围内）
npm outdated                    # 查看过时的依赖
npm ls / npm ls --depth=0       # 查看已安装的依赖树
npm run <脚本名>                 # 运行 package.json 中的 scripts
npm ci                          # 按 package-lock.json 精确安装（CI 环境用）
npm publish                     # 发布自己的包到 npm 仓库
`);

// ============================================================
// 3. 演示：安装第三方依赖后如何使用
//    （示例代码为注释，避免真的安装依赖）
// ============================================================
console.log('=== 3. 安装依赖后的使用方式 ===');
console.log(`
// ① 安装生产依赖
//   npm install dayjs

// ② 在代码中直接 import / require（node_modules 中的包不需要路径）
import dayjs from 'dayjs';
console.log(dayjs().format('YYYY-MM-DD'));

// ③ 安装开发依赖（如 TypeScript）
//   npm install -D typescript
`);

console.log('=== 演示完成 ===');
