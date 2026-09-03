# 006 - Node.js 中的回调函数是什么？请举例说明

## 题目

> Node.js 中的回调函数是什么？请举例说明

## 参考答案

**回调函数（Callback）是作为参数传递给另一个函数、在某个时机被"回头调用"的函数。** 它是 Node.js 处理异步操作最基础的方式：发起异步任务时不等待结果，把"拿到结果后要做的事"以回调的形式交出去，任务完成后由事件循环触发回调。

### 1. 同步回调：立即执行

```ts
const doubled = [1, 2, 3].map((n) => n * 2); // (n) => n * 2 就是回调
```

### 2. 异步回调：稍后执行

```ts
// 定时器回调
setTimeout(() => console.log('1 秒后触发'), 1000);

// 文件读取回调
readFile('./a.txt', 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
```

### 3. 错误优先回调（Error-first Callback）——Node.js 约定

Node.js 所有异步 API 的回调**第一个参数固定为 `err`**：

```ts
function callback(err, result) {
  if (err) {
    // 出错处理
    return;
  }
  // 使用 result
}
```

- `err` 为 `null`/`undefined` 表示成功
- 错误对象通常带 `code`（如 `ENOENT`）、`message` 属性
- **必须先判断 err 再使用 result**，否则错误时 result 是 undefined

### 4. 回调地狱（Callback Hell）及其解决

多个异步操作有依赖关系时，回调会层层嵌套：

```ts
step1((err, r1) => {
  step2(r1, (err, r2) => {
    step3(r2, (err, r3) => {
      /* 越缩越深，难以维护 */
    });
  });
});
```

解决方案（演进顺序）：

1. **Promise**：`.then().catch()` 链式调用
2. **async/await**：用同步写法处理异步（推荐）
3. 拆分函数、使用 `Promise.all` 并发

```ts
const r1 = await step1();
const r2 = await step2(r1);
const r3 = await step3(r2);
```

## 示例代码说明（[index.ts](./index.ts)）

1. 同步回调（`map` / `filter`）
2. 异步回调（`setTimeout`）
3. 错误优先回调（`readFile` 成功与失败两种情况）
4. 真实的回调地狱示例（嵌套 3 层）
5. 用 `async/await` 改写，对比可读性

## 运行示例

```bash
npm run demo:006
```

## 常见追问

1. **回调函数和闭包的关系？**
   回调通常以闭包形式存在（捕获外层变量），但两者是不同概念：闭包是"函数+其词法环境"，回调是"被传递以待调用的函数"。
2. **回调风格和 Promise 风格可以互转吗？**
   可以。`util.promisify(fn)` 把错误优先回调风格的函数转成返回 Promise 的函数；`util.callbackify` 反向转换。
3. **为什么不直接用同步 API？**
   同步 I/O 会阻塞事件循环，服务器场景下所有并发请求都会被卡住（详见 004 题）。
