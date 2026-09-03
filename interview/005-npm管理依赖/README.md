# 005 - 什么是 npm？如何使用它来管理项目的依赖？

## 题目

> 什么是 npm？如何使用它来管理项目的依赖？

## 参考答案

### 什么是 npm

**npm（Node Package Manager）** 是 Node.js 官方自带的**包管理器**，包含三部分：

1. **npm CLI**：命令行工具（安装 / 卸载 / 更新 / 发布包）
2. **npm registry**：线上包仓库（registry.npmjs.org），全球最大的开源代码生态
3. **npm website**：包的搜索与文档站点

### 常用命令

| 命令                      | 作用                                                  |
| ------------------------- | ----------------------------------------------------- |
| `npm init -y`             | 快速生成 `package.json`                               |
| `npm install`（`npm i`）  | 安装 `package.json` 里的全部依赖                      |
| `npm install <pkg>`       | 安装生产依赖（写入 `dependencies`）                   |
| `npm install -D <pkg>`    | 安装开发依赖（写入 `devDependencies`，如 TS、ESLint） |
| `npm install <pkg>@2.1.0` | 安装指定版本                                          |
| `npm install -g <pkg>`    | 全局安装（一般是 CLI 工具，如 `nodemon`）             |
| `npm uninstall <pkg>`     | 卸载依赖                                              |
| `npm update <pkg>`        | 在语义化版本范围内升级                                |
| `npm outdated`            | 查看哪些依赖过时了                                    |
| `npm ls --depth=0`        | 查看直接依赖列表                                      |
| `npm run <script>`        | 运行 `package.json` 中 `scripts` 定义的脚本           |
| `npm ci`                  | 严格按 `package-lock.json` 安装（CI/生产环境用）      |
| `npm publish`             | 发布自己的包                                          |

### 语义化版本（SemVer）

版本格式：`主版本.次版本.修订号`（`MAJOR.MINOR.PATCH`）

| 符号     | 含义                           | 示例              |
| -------- | ------------------------------ | ----------------- |
| `^1.2.3` | 允许次版本和修订号升级（默认） | `1.2.3` ~ `1.x.x` |
| `~1.2.3` | 只允许修订号升级               | `1.2.3` ~ `1.2.x` |
| `1.2.3`  | 锁定精确版本                   | 只能是 `1.2.3`    |

### 依赖相关的文件

| 文件                | 作用                                             |
| ------------------- | ------------------------------------------------ |
| `package.json`      | 声明依赖的**范围**（^ ~ 版本约束）               |
| `package-lock.json` | 锁定实际安装的**精确版本**，保证团队/CI 环境一致 |
| `node_modules/`     | 依赖的实际安装目录（不提交 git）                 |

## 示例代码说明（[npm-demo.ts](./npm-demo.ts)）

使用 `node:child_process` 的 `execSync` 调用真实的 npm 命令，查看 npm 版本和源，并输出常用命令速查表。

## 运行示例

```bash
npm run demo:005
```

## 常见追问

1. **dependencies 和 devDependencies 的区别？**
   生产依赖运行时需要（如 express）；开发依赖只在开发/构建时用（如 typescript、eslint），`npm install --production` 时不会安装。
2. **package-lock.json 要提交吗？**
   要。它保证所有环境和所有人安装完全一致的版本。
3. **npm ci 和 npm install 的区别？**
   `npm ci` 只按 lock 文件精确安装、先删除 node_modules、速度快、lock 不匹配时报错，适合 CI。
4. **npm / yarn / pnpm 的区别？**
   都是包管理器；pnpm 用硬链接节省磁盘并严格隔离依赖，yarn 有 PnP/零安装等特性，npm 是官方默认。
