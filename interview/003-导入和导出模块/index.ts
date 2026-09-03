/**
 * 003 - 在 Node.js 中，如何导入和导出模块？
 *
 * Node.js 支持两套模块系统：
 * 1. CommonJS（CJS，默认）：module.exports / exports 导出，require() 导入
 * 2. ES Modules（ESM）：export / export default 导出，import 导入
 *    （需要 "type": "module" 或 .mjs 后缀）
 *
 * 本文件演示各种导入方式（导出示例见 math.ts / greet.ts）
 */

import { createRequire } from 'node:module';
import * as path from 'node:path';

// ============================================================
// 1. ESM 导入：命名导入 + 默认导入（来自 math.ts）
// ============================================================
import { PI, add, subtract } from './math';
import Calculator from './math';

console.log('=== 1. ESM 导入（math.ts） ===');
console.log('命名导入 PI =', PI);
console.log('命名导入 add(1, 2) =', add(1, 2));
console.log('命名导入 subtract(10, 4) =', subtract(10, 4));
console.log('默认导入 Calculator.double(21) =', new Calculator().double(21));
console.log('静态属性 Calculator.version =', Calculator.version);

// ============================================================
// 2. 导入 CommonJS 模块（greet.ts 使用 export = 即 module.exports）
// ============================================================
import greetModule from './greet';

console.log('\n=== 2. CommonJS 导入（greet.ts） ===');
console.log(greetModule.greet('Node.js'));
console.log(greetModule.farewell('CommonJS'));

// ============================================================
// 3. 导入 Node.js 内置模块（推荐加 node: 前缀）
// ============================================================
console.log('\n=== 3. 导入内置模块 ===');
console.log('path.join("a", "b") =', path.join('a', 'b'));

// ============================================================
// 4. 动态导入：import() 返回 Promise，适合按需加载
// ============================================================
console.log('\n=== 4. 动态导入 import() ===');
console.log('发起动态导入...');
import('./math.js').then((math) => {
  console.log('动态导入完成，math.add(3, 4) =', math.add(3, 4));
});

// ============================================================
// 5. createRequire：在 ESM 中构造 require 函数（用于加载 CJS）
//    注：本文件编译为 CommonJS 后 require 是保留名，
//    故命名为 nodeRequire（在真正的 ESM 中可直接命名为 require）
// ============================================================
console.log('\n=== 5. createRequire ===');
const nodeRequire = createRequire(__filename);
const greetRequired = nodeRequire('./greet');
console.log('require 加载结果:', greetRequired.greet('require'));

// ============================================================
// 6. CommonJS 原生写法对照（JavaScript 中）：
//    const { add } = require('./math')
//    module.exports = { name: 'xxx' }
//    exports.name = 'xxx'  // exports 是 module.exports 的引用
// ============================================================
console.log('\n=== 6. CommonJS 原生写法（对照） ===');
console.log('导出：module.exports = { name: "xxx" }');
console.log('导入：const { name } = require("./module")');
