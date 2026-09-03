# 009 - 如何在 Node.js 中捕获和处理异常？

## 题目

> 如何在 Node.js 中捕获和处理异常？

## 参考答案

不同代码风格的异常，捕获方式不同：

### 1. 同步异常：`try / catch`

```ts
try {
  const data = fs.readFileSync('./config.json', 'utf-8');
} catch (error) {
  const err = error as NodeJS.ErrnoException;
  console.log(err.code, err.message); // 例如 ENOENT, no such file or directory
}
```

### 2. 错误优先回调：判断第一个 `err` 参数

> `try/catch` 包住异步调用的**外层捕获不到回调里发生的错误**（回调执行时同步代码已经走完）。

```ts
fs.readFile('./a.txt', 'utf-8', (err, data) => {
  if (err) {
    console.error('出错:', err.message);
    return; // 必须提前返回
  }
  console.log(data);
});
```

### 3. Promise / async-await

```ts
// .catch() 风格
readFile('./a.txt', 'utf-8').catch((err) => console.error(err));

// async/await + try/catch（推荐）
try {
  const data = await readFile('./a.txt', 'utf-8');
} catch (error) {
  console.error(error);
}
```

### 4. 自定义错误类

```ts
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

try { ... } catch (e) {
  if (e instanceof ValidationError) { /* 业务错误 */ }
}
```

### 5. 全局兜底（最后防线）

```ts
// 捕获所有未被 try/catch 处理的同步异常
process.on('uncaughtException', (err) => {
  console.error('致命错误:', err);
  process.exit(1); // 记录日志后应退出进程，由 PM2/systemd 等拉起
});

// 捕获未被 .catch() 处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  console.error('未处理的拒绝:', reason);
});
```

> 生产建议：全局兜底只用于**记录日志**，进程状态已不可信，应尽快优雅退出再由进程管理器重启；不要依赖它"吞掉"错误继续运行。

### 最佳实践

1. 尽早失败（fail fast），错误不要静默吞掉
2. 区分**业务错误**（可预期，返回给用户）与**系统错误**（记录日志+报警）
3. 中间件统一处理（Express 错误中间件 / Koa `app.onerror`）
4. `throw` 只抛 `Error` 对象（带堆栈），不要抛字符串

## 示例代码说明（[index.ts](./index.ts)）

1. 同步 `try/catch` 捕获 `readFileSync` 错误（展示 `err.code`）
2. 错误优先回调（并演示外层 try/catch 捕获不到异步错误）
3. `.catch()` 与 `async/await` 两种异步捕获方式
4. 自定义 `ValidationError` 错误类
5. `uncaughtException` / `unhandledRejection` 全局兜底（定时器抛错 + 未处理的 Promise 拒绝）

## 运行示例

```bash
npm run demo:009
```

## 常见追问

1. **`uncaughtException` 触发后进程还能继续跑吗？**
   技术上能（注册了监听器就不会崩溃），但 Node 官方建议记录日志后退出，因为此时程序可能处于不一致状态。
2. **`error.cause` 是什么？**
   ES2022 新增，包装错误时保留原始错误，方便追根溯源。
3. **Express/Koa 如何统一错误处理？**
   Express：四参数错误中间件 `(err, req, res, next) => {}`；Koa：`app.use(async (ctx, next) => { try { await next() } catch (e) {...} })`。
