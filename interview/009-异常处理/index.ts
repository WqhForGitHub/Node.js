/**
 * 009 - 如何在 Node.js 中捕获和处理异常？
 *
 * 不同代码风格的异常，捕获方式不同：
 * 1. 同步代码：try / catch
 * 2. 错误优先回调：在回调里判断第一个 err 参数
 * 3. Promise：.catch() 或 async/await + try/catch
 * 4. 自定义错误类：继承 Error，便于分类处理
 * 5. 全局兜底：process 的 uncaughtException / unhandledRejection
 */

import { readFileSync, readFile } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';

// ============================================================
// 1. 同步异常：try / catch
// ============================================================
console.log('=== 1. 同步异常：try / catch ===');
try {
  const content: string = readFileSync('不存在的文件.txt', 'utf-8');
  console.log(content); // 不会执行到这里
} catch (error) {
  const err = error as NodeJS.ErrnoException;
  console.log('捕获同步异常: code =', err.code, '| message =', err.message);
}

// ============================================================
// 2. 错误优先回调：try/catch 捕获不到回调里的错误，必须判断 err
// ============================================================
console.log('\n=== 2. 错误优先回调 ===');
try {
  readFileWithCallback((err, data) => {
    if (err) {
      console.log('回调中处理错误:', err.message);
      return;
    }
    console.log('成功:', data);
  });
} catch {
  console.log('注意：这里捕获不到异步回调中抛出的错误！');
}

/** 模拟一个异步操作（读取不存在的文件） */
function readFileWithCallback(callback: (err: Error | null, data?: string) => void): void {
  setImmediate(() => {
    readFile('不存在的文件.txt', 'utf-8', (err, data) => {
      if (err) {
        callback(err as Error);
      } else {
        callback(null, data);
      }
    });
  });
}

// ============================================================
// 3. Promise / async-await 的异常捕获
// ============================================================
console.log('\n=== 3. Promise / async-await ===');

async function readConfig(): Promise<void> {
  try {
    await readFileAsync('不存在的配置.json', 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    console.log('async/await 捕获: code =', err.code);
  }
}

readConfig();

// .catch() 风格
readFileAsync('不存在的文件2.txt', 'utf-8').catch((error: Error) => {
  console.log('.catch() 捕获:', error.message);
});

// ============================================================
// 4. 自定义错误类：继承 Error，实现业务级错误分类
// ============================================================
console.log('\n=== 4. 自定义错误类 ===');

class ValidationError extends Error {
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'ValidationError'; // 保留名称便于识别
    this.field = field;
  }
}

function validateAge(age: number): void {
  if (age < 0) {
    throw new ValidationError('年龄不能为负数', 'age');
  }
}

try {
  validateAge(-1);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`业务校验错误 [${error.name}] 字段 ${error.field}: ${error.message}`);
  } else {
    console.log('未知错误:', error);
  }
}

// ============================================================
// 5. 全局兜底：捕获所有未被处理的异常（最后防线）
// ============================================================
console.log('\n=== 5. 全局兜底 ===');

// 捕获未被 try/catch 处理的同步异常
process.on('uncaughtException', (error: Error) => {
  console.log('[uncaughtException]', error.message);
});

// 捕获未被 .catch() 处理的 Promise 拒绝
process.on('unhandledRejection', (reason: unknown) => {
  console.log('[unhandledRejection]', (reason as Error).message);
});

// 场景 A：定时器回调里抛出的异常，外层 try/catch 捕获不到
setTimeout(() => {
  throw new Error('定时器回调中的同步异常');
}, 50);

// 场景 B：没有 .catch() 的 Promise 拒绝
Promise.reject(new Error('未处理的 Promise 拒绝'));

console.log('演示注册完成，等待全局兜底输出...');
