# 003 - 在 Node.js 中，如何导入和导出模块？

## 题目

> 在 Node.js 中，如何导入和导出模块？

## 参考答案

Node.js 支持 **两套模块系统**：

### 1. CommonJS（CJS，Node.js 默认）

```js
// 导出（module.exports / exports）
module.exports = { name: '张三', say() {} };
// 或者
exports.name = '张三'; // exports 是 module.exports 的引用

// 导入
const user = require('./user');
const { name } = require('./user');
const path = require('node:path'); // 内置模块
```

### 2. ES Modules（ESM，语言标准）

```ts
// 导出
export const PI = 3.14; // 命名导出
export default class Math {} // 默认导出（每个模块只能有一个）
export * from './other'; // 转发导出

// 导入
import path from 'node:path';
import Math, { PI } from './math';
import('./math'); // 动态导入，返回 Promise
```

> 使用 ESM 需在 `package.json` 中设置 `"type": "module"`（或使用 `.mjs` 后缀）。

### 两者对比

| 对比项          | CommonJS                     | ES Modules                          |
| --------------- | ---------------------------- | ----------------------------------- |
| 加载时机        | 运行时加载（可动态路径）     | 编译期静态分析（支持 Tree-shaking） |
| 导出方式        | 值的拷贝                     | 值的引用（绑定）                    |
| `this` 顶层指向 | `module.exports`             | `undefined`                         |
| 循环依赖        | 返回已执行部分               | 引用（可能拿到未初始化的值）        |
| 语法            | `require` / `module.exports` | `import` / `export`                 |

### 互相兼容

- ESM 中加载 CJS：直接 `import` 默认导出（`module.exports` 整体）
- CJS 中加载 ESM：使用动态 `import()`（因为 ESM 是异步加载的）
- `createRequire()`：在 ESM 中构造 `require` 函数

## 示例文件说明

| 文件                   | 内容                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| [math.ts](./math.ts)   | ESM 导出：`export`（命名）+ `export default`（默认）                    |
| [greet.ts](./greet.ts) | CommonJS 导出：`export =`（等价 `module.exports`）                      |
| [index.ts](./index.ts) | 各种导入方式：命名/默认导入、内置模块、动态 `import()`、`createRequire` |

## 运行示例

```bash
npm run demo:003
```

## 常见追问

1. **`module.exports` 和 `exports` 的区别？**
   `exports` 是 `module.exports` 的初始引用，`exports.a = 1` 可用；但 `exports = {...}` 会切断引用、无效，必须用 `module.exports = {...}`。
2. **require 的查找规则？**
   内置模块 -> 文件（`.js/.json/.node`）-> 目录（`package.json` 的 `main` 或 `index.js`）-> `node_modules` 逐级向上。
3. **TS 中 `import type` 的作用？**
   只导入类型，编译后会被完全擦除，避免产生运行时的 `require`。
