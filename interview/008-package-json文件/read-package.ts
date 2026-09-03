/**
 * 008 - 什么是 package.json 文件？它的作用是什么？
 *
 * package.json 是项目的"身份证 + 说明书 + 任务清单"：
 * 1. 描述项目元信息（名称、版本、描述、作者、协议）
 * 2. 声明依赖及版本范围（dependencies / devDependencies）
 * 3. 定义可执行脚本（scripts）
 *
 * 它本质上就是一个 JSON 文件，可以用 fs 读取 + JSON.parse 解析。
 * 本文件读取同目录的 package-demo.json（示例文件）进行演示。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** package.json 常用字段的 TypeScript 类型描述 */
interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  type?: 'commonjs' | 'module';
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

// ============================================================
// 1. package.json 就是一个 JSON 文件，直接读取解析
// ============================================================
const pkgPath: string = join(__dirname, 'package-demo.json');
const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));

console.log('=== 1. 项目元信息 ===');
console.log('名称:   ', pkg.name);
console.log('版本:   ', pkg.version);
console.log('描述:   ', pkg.description);
console.log('入口:   ', pkg.main);
console.log('模块系统:', pkg.type);
console.log('引擎要求:', pkg.engines);

// ============================================================
// 2. scripts：npm run xxx 执行的命令
// ============================================================
console.log('\n=== 2. scripts（可执行脚本） ===');
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  console.log(`  npm run ${name}  ->  ${command}`);
}

// ============================================================
// 3. 依赖声明：dependencies vs devDependencies
// ============================================================
console.log('\n=== 3. 依赖声明 ===');
console.log('dependencies（生产依赖）:');
for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
  console.log(`  ${name}: ${range}`);
}
console.log('devDependencies（开发依赖）:');
for (const [name, range] of Object.entries(pkg.devDependencies ?? {})) {
  console.log(`  ${name}: ${range}`);
}

// ============================================================
// 4. 语义化版本解析
// ============================================================
console.log('\n=== 4. 语义化版本（SemVer） ===');
const semverExamples: Array<[string, string]> = [
  ['^4.21.0', '允许 4.x.x（次版本+修订号可升级，默认）'],
  ['~1.11.13', '只允许 1.11.x（仅修订号可升级）'],
  ['5.7.0', '精确锁定 5.7.0'],
];
for (const [range, meaning] of semverExamples) {
  console.log(`  ${range.padEnd(10)} ${meaning}`);
}

console.log('\n读取并解析 package-demo.json 完成');
