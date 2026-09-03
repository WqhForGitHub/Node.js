# 008 - 什么是 package.json 文件？它的作用是什么？

## 题目

> 什么是 package.json 文件？它的作用是什么？

## 参考答案

**`package.json` 是 Node.js 项目的配置清单文件**，位于项目根目录，由 `npm init` 生成。它是一个普通 JSON 文件，核心作用有四个：

1. **项目元信息**：名称、版本、描述、作者、协议等"身份证"
2. **依赖管理**：声明项目依赖哪些包及版本范围，`npm install` 据此安装
3. **脚本入口**：`scripts` 定义 `npm run xxx` 可执行的命令
4. **约束环境**：`engines` 声明 Node 版本要求，`main`/`exports` 声明包入口

### 常用字段说明

| 字段               | 作用                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `name` / `version` | 包名和版本（发布到 npm 时必填，两者构成唯一标识）                    |
| `description`      | 项目描述                                                             |
| `main`             | 包的入口文件（默认 `index.js`）                                      |
| `type`             | `"commonjs"`（默认）或 `"module"`，决定 `.js` 文件按哪种模块系统解析 |
| `scripts`          | 自定义命令，如 `npm run dev`                                         |
| `dependencies`     | **生产依赖**，运行时需要（如 express）                               |
| `devDependencies`  | **开发依赖**，仅开发/构建时需要（如 typescript、eslint）             |
| `engines`          | 声明所需的 Node/npm 版本                                             |
| `bin`              | 声明 CLI 命令（`npx` 执行的入口）                                    |
| `private`          | `true` 时禁止 `npm publish`，防止私有项目误发布                      |
| `license`          | 开源协议（MIT / Apache-2.0 等）                                      |

### scripts 的特殊简写

| 命令                           | 说明                                  |
| ------------------------------ | ------------------------------------- |
| `npm start`                    | `npm run start` 的简写                |
| `npm test`                     | `npm run test` 的简写                 |
| `npm run`                      | 列出所有可用脚本                      |
| `pre<script>` / `post<script>` | 在某脚本前后自动执行（如 `prebuild`） |

### 版本范围（SemVer）

```json
"express": "^4.21.0"   // ^ 允许 4.x.x
"dayjs": "~1.11.13"    // ~ 只允许 1.11.x
"typescript": "5.7.0"  // 精确锁定
```

## 示例文件说明

| 文件                                     | 内容                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| [package-demo.json](./package-demo.json) | 一个完整的 package.json 示例（演示用命名）                                                    |
| [read-package.ts](./read-package.ts)     | 用 `fs` + `JSON.parse` 读取解析 package-demo.json，逐项打印元信息、scripts、依赖、SemVer 说明 |

> 演示文件命名为 `package-demo.json` 以避免被识别为真实的包配置；实际项目中它就叫 `package.json`。

## 运行示例

```bash
npm run demo:008
```

## 常见追问

1. **package.json 和 package-lock.json 的区别？**
   `package.json` 声明版本**范围**（^ ~），`package-lock.json` 锁定实际安装的**精确版本**和依赖树，保证环境一致。
2. **dependencies 和 devDependencies 何时生效？**
   `npm i express` 进 dependencies；`npm i -D typescript` 进 devDependencies；`npm i --production` 时跳过 devDependencies。
3. **`"type": "module"` 有什么影响？**
   项目内 `.js` 文件按 ESM 解析（用 `import`），否则按 CommonJS（用 `require`）。
