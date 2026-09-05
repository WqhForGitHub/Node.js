# Node.js 模块加载机制

Node.js 的模块系统遵循 **CommonJS 规范**（`require()`），同时支持 ES Module（`import/export`），我们重点讲最核心的 CommonJS 加载机制，包含**模块分类、加载顺序、查找规则、缓存、模块包装**。

> Node.js 每个文件就是一个独立模块，拥有自己作用域，变量不会污染全局。

## 一、模块分类

1. **内置模块（核心模块）**：node 源码编译自带，如 `fs`、`path`、`http`。直接 `require('fs')`，优先加载，不用找文件。
2. **文件模块**：自己写的 js/json，`.node` 编译插件。分相对路径、绝对路径。
3. **第三方模块**：存放在 `node_modules`，npm 安装的包。

## 二、require() 模块查找优先级（核心流程）

```js
require('xxx');
```

查找顺序从上到下，命中就停止：

1. **先判断是否是内置核心模块**，是直接加载；
2. 如果是**路径形式**（`./` `../` `/`）：当作文件模块，按文件规则查找；
3. **非路径字符串**（第三方包，如 `lodash`）：逐级向上查找 `node_modules` 目录。

### 1）文件模块查找规则（`./demo`）

不给后缀时，自动补后缀尝试：`.js` → `.json` → `.node`

- 如果 `./demo` 是**文件**：依次试 `demo.js`、`demo.json`、`demo.node`
- 如果 `./demo` 是**文件夹**：读取文件夹内 `package.json` 的 `main` 字段；
  - 没有 `package.json` 或者 main 不存在，则找目录下 `index.js/index.json/index.node`

### 2）第三方包查找 node_modules

`require('lodash')`

1. 当前文件所在目录下 `node_modules/lodash`
2. 上一级目录 `../node_modules/lodash`
3. 一直向上递归，直到磁盘根目录；
4. 根目录找不到抛出 `Cannot find module`。

> Windows：C:\\ ，Linux/Mac：/

## 三、模块缓存（非常关键）

Node **模块第一次 require 执行后会缓存**，存于 `require.cache` 对象。
**同一个模块多次 require，只会执行一次代码，直接返回缓存导出对象。**

```js
// a.js
console.log('a 执行');
module.exports = { num: 1 };

// main.js
const a1 = require('./a'); // 打印 a执行
const a2 = require('./a'); // 不会打印，直接拿缓存
console.log(a1 === a2); // true，同一个引用
```

- `require.cache['绝对路径']` 可以手动删除缓存，实现热更新。

> 缓存 key 是**模块的绝对文件路径**，路径不同就算文件一样也会生成两份缓存。

## 四、模块包装函数（Module Wrapper）

你写的 js 文件，Node 不会直接执行，会把代码包裹一层函数，实现私有作用域。

原始你的代码：

```js
const name = 'test';
module.exports = name;
```

实际被包装后执行：

```js
(function (exports, require, module, __filename, __dirname) {
  const name = 'test';
  module.exports = name;
});
```

5个注入参数：

1. `exports`：module.exports 的引用，简易导出
2. `require`：导入函数
3. `module`：当前模块对象，`module.exports` 真正导出出口
4. `__filename`：当前文件**绝对路径**
5. `__dirname`：当前文件所在文件夹**绝对路径**

> ⚠️ 注意：`exports = {}` 重写不会生效，只是修改局部变量；必须用 `module.exports`。

## 五、module.exports vs exports

- `exports` 是 `module.exports` 的**浅引用**
- 最终导出以 `module.exports` 为准。

```js
exports.a = 1; // ok，等价 module.exports.a =1
exports = { b: 2 }; // ❌ 无效！切断引用，不会导出
module.exports = { b: 2 }; // ✔正确
```

## 六、CommonJS 加载特点

1. **运行时加载**：`require()` 在运行阶段执行，可以写在 if、循环里面；
2. **拷贝/引用导出值**：导出是对象引用；普通值是导出时快照；
3. **同步加载**：require 是阻塞同步；
4. **模块缓存**；
5. 每个模块独立作用域。

## 七、ES Module（ESM import/export）区别（简单对比）

`.mjs` 或者 package.json 设置 `"type":"module"` 使用 ESM

| 特性         | CommonJS(require)            | ESM(import)                               |
| ------------ | ---------------------------- | ----------------------------------------- |
| 加载时机     | 运行时同步                   | 编译时静态分析                            |
| 语法         | module.exports / require     | import / export                           |
| 缓存         | require.cache                | 无暴露缓存对象                            |
| 顶层this     | 模块内 this = module.exports | 顶层 this = undefined                     |
| 可以条件导入 | ✅ require写if中             | ❌ import不能写if；可用import()动态import |

## 八、最佳实践

1. 引用本地文件**务必写 `./`**，否则会当成第三方包去查找 node_modules；
2. `exports` 只做追加属性，不要直接赋值覆盖；导出对象优先使用 `module.exports`；
3. 循环依赖：CommonJS 循环依赖只会拿到**已经导出的部分值**，容易出现 `undefined`；
4. 热更新场景：删除 `require.cache[绝对路径]` 清除缓存再重新 require。

## 循环依赖简单示例

```js
// a.js
exports.x = 1;
const b = require('./b');
console.log(b.y);
exports.x = 2;

// b.js
exports.y = 10;
const a = require('./a'); // a此时只导出{x:1}，还没执行到x=2
console.log(a.x); // 输出 1
exports.y = 20;
```

如果你需要，我可以画一张完整的 require 加载流程图，或者讲讲 Node `Module` 类源码层面的简要逻辑。
