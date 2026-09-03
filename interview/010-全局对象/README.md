# 010 - 什么是 Node.js 全局对象？有哪些全局对象？

## 题目

> 什么是 Node.js 全局对象？有哪些全局对象？

## 参考答案

**全局对象是指在任何模块中无需 `require` / `import` 就能直接使用的对象和函数。** Node.js 的全局对象是 **`globalThis`**（别名 `global`），对应浏览器中的 `window`。

### 常用全局对象清单

#### 1. `globalThis` / `global`（全局对象本身）

```ts
globalThis.myVar = 'hello'; // 挂载全局变量（不推荐滥用，易造成命名冲突）
```

#### 2. `process`（进程对象，最常用）

| 属性/方法                                                 | 说明                                 |
| --------------------------------------------------------- | ------------------------------------ |
| `process.argv`                                            | 命令行参数数组                       |
| `process.env`                                             | 环境变量（`NODE_ENV`、数据库密码等） |
| `process.pid` / `process.ppid`                            | 进程 ID / 父进程 ID                  |
| `process.platform` / `process.arch`                       | 操作系统 / CPU 架构                  |
| `process.cwd()`                                           | 当前工作目录                         |
| `process.uptime()` / `process.memoryUsage()`              | 运行时长 / 内存占用                  |
| `process.exit([code])`                                    | 退出进程                             |
| `process.stdout` / `stderr` / `stdin`                     | 标准流                               |
| `process.on('exit' / 'uncaughtException' / 'SIGINT', fn)` | 进程事件/信号                        |

#### 3. `Buffer`（二进制数据处理）

```ts
const buf = Buffer.from('Hello');
buf.length; // 5（字节数）
buf.toString('hex'); // '48656c6c6f'
```

#### 4. `console`

`console.log` / `error` / `warn` / `info` / `table` / `time` / `timeEnd` / `dir` 等。

#### 5. 定时器相关（全局函数）

| 函数                              | 说明                        |
| --------------------------------- | --------------------------- |
| `setTimeout` / `clearTimeout`     | 延时执行（一次）            |
| `setInterval` / `clearInterval`   | 重复执行                    |
| `setImmediate` / `clearImmediate` | 当前事件循环 check 阶段执行 |
| `queueMicrotask`                  | 把任务加入微任务队列        |

#### 6. 模块级"伪全局"变量（仅 CommonJS）

`__dirname`、`__filename`、`require`、`module`、`exports` —— 它们其实是 CommonJS 模块包装函数 `(function (exports, require, module, __filename, __dirname) { ... })` 的参数，**不是真正的全局变量**，ESM 模块中不存在（ESM 中用 `import.meta.url` 代替）。

## 示例代码说明（[index.ts](./index.ts)）

逐个演示：`globalThis`、`process`（argv/env/cwd 等）、`Buffer`（编码转换）、`console.table`、四个定时器函数（含 clear 取消效果）、以及 CJS 伪全局变量的值。

## 运行示例

```bash
npm run demo:010

# 传入命令行参数体验 process.argv
npx tsx 010-全局对象/index.ts --env=production
```

## 常见追问

1. **浏览器和 Node.js 的全局对象区别？**
   浏览器是 `window`（+ `document` 等 DOM API）；Node.js 是 `globalThis`/`global`，提供 `process`、`Buffer` 等。`globalThis` 是两端的统一标准名。
2. **`process.nextTick` 是全局函数吗？**
   是，它把回调排到当前操作完成后立即执行（优先级高于 Promise 微任务）。
3. **`__dirname` 和 `process.cwd()` 的区别？**
   `__dirname` 是**文件所在目录**（固定）；`cwd()` 是**执行命令时所在的目录**（会变）。
