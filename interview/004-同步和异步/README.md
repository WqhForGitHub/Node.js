# 004 - Node.js 中，同步和异步代码有什么区别？

## 题目

> Node.js 中，同步和异步代码有什么区别？

## 参考答案

| 对比项   | 同步（Sync）                           | 异步（Async）                           |
| -------- | -------------------------------------- | --------------------------------------- |
| 执行方式 | 按顺序执行，当前操作完成后才执行下一行 | 发起操作后立即返回，结果稍后交付        |
| 是否阻塞 | **阻塞**主线程/事件循环                | **不阻塞**，主线程继续处理其他任务      |
| 结果获取 | 直接返回值                             | 回调函数 / Promise / async-await        |
| 报错方式 | `try/catch` 捕获                       | 错误优先回调 / `.catch()` / `try/await` |
| 使用建议 | 启动时读配置、CLI 脚本                 | **服务器等高并发场景必须用异步**        |

```ts
import { readFileSync, readFile } from 'node:fs';

// 同步：阻塞，直到读取完成
const data = readFileSync('./config.json', 'utf-8');

// 异步（回调）：发起后立即返回
readFile('./config.json', 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(data);
});

// 异步（Promise）：链式
import { readFile } from 'node:fs/promises';
const data2 = await readFile('./config.json', 'utf-8');
```

### 为什么要异步

Node.js 是**单线程事件循环**模型。如果使用同步 I/O，一个慢请求（如读大文件）会阻塞事件循环，**所有**其他请求都必须排队。异步 I/O 把等待工作交给底层（libuv 线程池/操作系统），主线程只处理回调，因此能以极低成本支撑高并发。

### 执行顺序（重点）

```text
同步代码 → 微任务（Promise.then / queueMicrotask / process.nextTick）→ 宏任务（setTimeout / setImmediate / I/O 回调）
```

### 同步的适用场景

- 程序启动时加载配置文件
- 一次性 CLI 脚本（无人并发，简单直接）
- 注意：`*_Sync` 系列 API 在 Web 服务器中几乎不应出现

## 示例代码说明（[index.ts](./index.ts)）

1. `readFileSync` 同步读取（观察阻塞）
2. `readFile` 回调风格异步读取
3. `fs/promises` + `async/await` 风格
4. 同步 → 微任务 → 宏任务的执行顺序
5. **同步阻塞实验**：用 1 秒空循环卡住事件循环，观察 setTimeout 回调被延迟

## 运行示例

```bash
npm run demo:004
```

## 常见追问

1. **async/await 是同步吗？**
   不是。`await` 只是让异步代码"看起来像同步"，它让出线程、不阻塞事件循环。
2. **`process.nextTick` 和 `Promise.then` 谁先？**
   `nextTick` 优先级更高，在微任务队列之前执行。
3. **`setImmediate` 和 `setTimeout(0)` 的区别？**
   `setImmediate` 在事件循环 check 阶段执行；`setTimeout` 在 timers 阶段。主模块中调用时顺序不确定，I/O 回调中 `setImmediate` 恒先执行。
