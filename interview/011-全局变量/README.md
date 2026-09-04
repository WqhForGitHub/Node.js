# Node.js 全局变量

> 浏览器有 `window` 全局对象；**Node.js 全局对象是 `globalThis`（推荐）/ `global`**，在模块中可以直接访问全局变量，不需要 `require`。
> ⚠️ 重点：**模块作用域下的 var/let/const 声明的变量不属于全局**，只属于当前模块，不会挂载到 `global`。

## 全局对象

1. **`globalThis`** ✅ 标准，浏览器+Node.js通用，优先使用
2. **`global`** Node.js 专属全局对象（旧写法）

```js
console.log(globalThis === global); // true
```

---

## Node.js 常用全局变量/全局API

### 1. 模块相关（**注意：这些不是真正全局，是模块内的顶层变量，每个模块独有**）

> 很多人会混淆：`__dirname`、`__filename`、`require`、`module`、`exports` **不属于 global，是模块函数的形参**，每个模块各自一份。

| 变量         | 说明                                  |
| ------------ | ------------------------------------- |
| `__dirname`  | 当前脚本**所在目录绝对路径**          |
| `__filename` | 当前脚本文件完整绝对路径              |
| `require()`  | 导入模块函数                          |
| `module`     | 当前模块对象                          |
| `exports`    | 模块导出对象，等价于 `module.exports` |

> ❗ ES Module(`import/export`) 模式下**没有** `__dirname`、`__filename`、`require`。

### 2. 真正挂载到 globalThis 的全局

#### 定时器

- `setTimeout()` / `clearTimeout()`
- `setInterval()` / `clearInterval()`
- `setImmediate()` / `clearImmediate()`：Node独有，事件循环check阶段执行

#### 进程 & 控制台

- `console`：打印日志对象 `console.log()`
- `process`：**最重要**，进程信息、环境变量、argv、事件监听

```js
process.env; // 环境变量
process.argv; // 命令行参数
process.exit(); // 退出进程
```

#### 错误

- `Buffer`：处理二进制缓冲区（Node核心）
- `AbortController`：中断控制器
- `TextEncoder` / `TextDecoder`：编解码

#### 基础内置构造函数（JS原生，浏览器也有）

`Object`、`Array`、`Number`、`String`、`Boolean`、`RegExp`、`Date`、`Math`、`Promise`、`Map`、`Set`、`Symbol`、`BigInt` 等。

---

## 容易踩坑点

1. CommonJS模块中直接写 `var a = 1`，**不会加到 global**，只在当前模块有效。只有显式赋值 `globalThis.a = 1` 才是真正全局。

```js
// a.js
var x = 10;
globalThis.y = 20;

// b.js
require('./a.js');
console.log(x); // ReferenceError，访问不到
console.log(y); // 20，可以拿到全局
```

2. `__dirname`、`require` 不是全局对象上的属性，是模块包装函数注入的变量。

```js
console.log(globalThis.__dirname); // undefined
```

Node加载CommonJS模块时会把代码包进函数执行：

```js
(function (exports, require, module, __filename, __dirname) {
  // 你的脚本代码
})();
```

## 小结区分

1. **真正全局（globalThis上）**：`process`、`Buffer`、`console`、定时器、JS原生内置对象。
2. **模块顶层变量（非global）**：`require`、`module`、`exports`、`__filename`、`__dirname`。

## 最佳实践

1. 尽量**不要滥用全局变量**，会污染命名空间，优先模块导出导入。
2. 访问全局对象统一用 `globalThis`，兼容浏览器和Node。
3. ESM模式不要使用 `__dirname`，改用 `import.meta.url` 实现等价能力。

如果你需要，我可以给一段示例代码演示 CommonJS 和 ESM 下全局行为差异。
