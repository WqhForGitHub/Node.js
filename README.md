如果你想学习原生 Node.js（不使用 Express、Koa、NestJS 等框架），建议从简单的命令行程序开始，逐步学习文件操作、异步编程、HTTP 服务、数据库和后端架构。

下面这套 Demo 练习路线，主要面向后端开发，使用 Node.js 内置模块，尽量不依赖第三方 npm 包。

# 一、原生 Node.js Demo 路线

## 第一阶段：基础入门

难度 ★

1～5：掌握 Node.js 基础 API

1. 命令行计算器
2. 文件读取与写入
3. 文件信息查看器
4. 批量文件重命名
5. JSON 通讯录管理工具

## 第二阶段：异步与系统编程

难度 ★★

6～10：掌握事件循环、流和进程

6\. 异步任务队列 7. 文件搜索工具 8. 大文件复制工具 9. 日志分析器 10. 子进程执行器

## 第三阶段：HTTP 后端开发

难度 ★★★

11～15：使用 http 模块构建服务端

11\. 原生 HTTP 服务器 12. 静态文件服务器 13. REST API 待办事项 14. 请求参数解析与校验 15. 中间件机制

## 第四阶段：完整后端功能

难度 ★★★★

16～20：接近真实项目

16\. 自定义路由系统 17. 用户注册与登录 18. 数据持久化与缓存 19. 限流与错误处理 20. 简易日志系统

## 第五阶段：综合项目

难度 ★★★★★

21～25：练习工程化与架构设计

21\. 命令行待办事项 CLI 22. 简易 WebSocket 聊天室 23. 定时任务调度器 24. 文件上传服务 25. 原生 Node.js 博客 API

## 二、每个阶段具体练什么？

| Demo               | 核心内置模块 / API          | 练习目标                 |
| ------------------ | --------------------------- | ------------------------ |
| 1. 命令行计算器    | `process.argv`              | 获取命令行参数           |
| 2. 文件读写        | `node:fs/promises`          | 读写文件、处理异常       |
| 3. 文件信息查看器  | `node:fs`、`node:path`      | 获取文件大小、扩展名     |
| 4. 批量重命名      | `node:fs/promises`          | 遍历目录、修改文件名     |
| 5. JSON 通讯录     | `fs`、`JSON`                | 数据增删改查             |
| 6. 异步任务队列    | `Promise`、`setTimeout`     | 并发控制、异步流程       |
| 7. 文件搜索        | `fs`、`path`                | 递归遍历目录             |
| 8. 大文件复制      | `node:fs`、Stream           | 流式读写、背压           |
| 9. 日志分析器      | `node:readline`、Stream     | 逐行读取、统计分析       |
| 10. 子进程执行器   | `node:child_process`        | 执行系统命令             |
| 11. HTTP 服务器    | `node:http`                 | 处理请求和响应           |
| 12. 静态文件服务器 | `http`、`fs`、`path`        | MIME 类型、路径安全      |
| 13. REST API       | `http`、`fs/promises`       | 实现 CRUD 接口           |
| 14. 参数校验       | `URL`、`URLSearchParams`    | 解析与校验请求数据       |
| 15. 中间件机制     | 函数组合、Promise           | 理解 Express/Koa 原理    |
| 16. 路由系统       | `http`、`URL`               | 路由匹配、参数提取       |
| 17. 登录系统       | `node:crypto`               | 密码哈希、会话管理       |
| 18. 数据持久化     | `fs`、`Map`                 | 文件存储、内存缓存       |
| 19. 限流系统       | `Map`、时间戳               | 请求计数与限流           |
| 20. 日志系统       | `fs`、Stream                | 日志分级、滚动写入       |
| 21. CLI 工具       | `process.argv`、`fs`        | 设计可复用命令行工具     |
| 22. 聊天室         | `node:http`、`node:crypto`  | WebSocket 协议与连接管理 |
| 23. 任务调度器     | `setTimeout`、`setInterval` | 定时执行、任务状态       |
| 24. 文件上传       | `http`、Stream              | 请求体处理、文件写入     |
| 25. 博客 API       | 多个内置模块                | 组合成完整后端服务       |

注意：第 22 项需要自己实现 WebSocket 协议或使用原生 TCP 等底层能力；第 17 项的密码哈希可以使用 Node.js 内置的 `crypto.scrypt`。这些 Demo 都可以不安装第三方 npm 包，但实际生产环境的身份认证、文件上传等功能还需要更严格的安全设计。

## 三、先动手写第一个 Demo：命令行计算器

目标：理解 Node.js 如何接收终端输入的参数。

创建项目目录：

```
node-demos/
└── demo-01-calculator/
    └── index.js
```

`index.js`：

```javascript
const [,, operator, a, b] = process.argv;

const num1 = Number(a);
const num2 = Number(b);

if (!['add', 'sub', 'mul', 'div'].includes(operator)) {
  console.log('用法：node index.js <add|sub|mul|div> <数字1> <数字2>');
  process.exitCode = 1;
} else if (!Number.isFinite(num1) || !Number.isFinite(num2)) {
  console.log('请输入有效数字');
  process.exitCode = 1;
} else {
  let result;

  switch (operator) {
    case 'add':
      result = num1 + num2;
      break;
    case 'sub':
      result = num1 - num2;
      break;
    case 'mul':
      result = num1 * num2;
      break;
    case 'div':
      if (num2 === 0) {
        console.log('除数不能为 0');
        process.exitCode = 1;
        break;
      }
      result = num1 / num2;
      break;
  }

  if (result !== undefined) {
    console.log('计算结果：', result);
  }
}
```

运行：

```shell
node index.js add 10 20
# 计算结果：30

node index.js mul 5 6
# 计算结果：30

node index.js div 10 2
# 计算结果：5
```

### 四、这个 Demo 要掌握的知识点

1\. `process.argv` 是什么？

它是一个数组，用来保存启动 Node.js 时传入的命令行参数。

运行：

```shell
node index.js add 10 20
```

参数大致如下：

```
[
  'node 的路径',
  'index.js 的路径',
  'add',
  '10',
  '20'
]
```

所以：

```
const [,, operator, a, b] = process.argv;
```

这里跳过前两个元素，取出 `add`、`10`、`20`。

2\. 为什么要使用 `Number()`？

因为命令行参数默认是字符串：

```javascript
'10' + '20' // '1020'

Number('10') + Number('20') // 30
```

3\. 为什么需要判断除数为 0？

因为 JavaScript 中：

```javascript
10 / 0 // Infinity
```

虽然不会抛出异常，但通常不符合计算器的业务需求。

### 五、验收标准

Demo 01 完成清单

0/5

能够正确执行加、减、乘、除

能够处理缺少参数的情况

能够拒绝无效数字

能够处理除数为 0

自己新增一个求平方的功能

我的建议： 不要一次性把 25 个 Demo 全部写完。按照每个 Demo 的“学习原理 → 自己实现 → 测试边界情况 → 扩展功能”的顺序推进。完成前 15 个后，你对 Node.js 异步编程、文件系统、HTTP 请求处理和后端框架的底层原理会有更扎实的理解。