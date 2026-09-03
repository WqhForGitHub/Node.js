# 001 - 什么是 Node.js？它的主要特点是什么？适用于哪些场景？

## 题目

> 什么是 Node.js？它的主要特点是什么？适用于哪些场景？

## 参考答案

### 什么是 Node.js

**Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境（Runtime）**。它把 V8 引擎嵌入到一个 C++ 编写的宿主程序中，提供了文件系统、网络、进程等操作系统级 API，让 JavaScript 能够脱离浏览器运行在服务端。

### 主要特点

| 特点                               | 说明                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| **事件驱动（Event-driven）**       | 大量 API 以事件和回调的形式工作，任务完成后通过事件通知                                     |
| **非阻塞 I/O（Non-blocking I/O）** | I/O 操作（文件、网络、数据库）不会阻塞主线程，由底层线程池（libuv）完成                     |
| **单线程事件循环（Event Loop）**   | JavaScript 代码运行在单个主线程上，通过事件循环调度异步任务，避免多线程上下文切换和锁的开销 |
| **跨平台**                         | 一份代码运行在 Windows / macOS / Linux                                                      |
| **生态丰富**                       | npm 拥有全球最大的开源包生态                                                                |
| **单进程多并发**                   | 一个线程即可维持成千上万的并发连接                                                          |

> 注意：Node.js 的"单线程"指的是 **JavaScript 执行线程是单线程**，底层 libuv 仍然有线程池（默认 4 个）处理 DNS、文件 I/O 等任务。

### 适用场景

- **I/O 密集型应用**（最擅长）：REST API 服务、Web 服务器、BFF 中间层
- **实时应用**：WebSocket 聊天、消息推送、在线协作
- **流式处理**：文件上传下载、音视频转码管道
- **工具链**：CLI 工具、构建工具（Webpack、Vite）、脚手架
- **服务端渲染（SSR）**：Next.js、Nuxt

### 不适用的场景

- **CPU 密集型任务**（如大量数学计算、图片处理）：长时间占用主线程会阻塞事件循环，导致所有请求排队。解决方式：`worker_threads`（工作线程）或 `child_process`（子进程）。

## 关键 API

```ts
import { versions, platform } from 'node:process'; // 运行时信息
import { stat } from 'node:fs/promises'; // 非阻塞 I/O
import { createHash } from 'node:crypto'; // 内置模块
```

## 运行示例

```bash
npm run demo:001
```

输出会依次演示：运行时信息（V8 版本）→ 非阻塞 I/O → 事件循环执行顺序 → 内置模块能力。

## 常见追问

1. **Node.js 和浏览器中 JavaScript 的区别？**
   全局对象不同（`globalThis` vs `window`）、有无 DOM、模块系统（CJS/ESM vs ESM）、可否操作文件系统。
2. **为什么 Node.js 适合高并发？**
   单线程 + 非阻塞 I/O，处理一个请求时不等待 I/O，立刻处理下一个，用少量内存维持大量连接。
3. **CPU 密集任务怎么办？**
   `worker_threads` 多线程 / `child_process` 多进程 / `cluster` 集群。
