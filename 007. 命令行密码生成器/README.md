# 命令行密码生成器

纯 Node.js 实现的命令行密码生成器，**零第三方依赖**，使用 `crypto` 模块保证密码的加密学随机性。

## 功能特性

- 加密安全的随机数生成（基于 `crypto.randomBytes` 和 `crypto.randomInt`）
- 支持自定义密码长度（默认 12 位）
- 支持字符类型组合：小写字母 / 大写字母 / 数字 / 特殊符号
- 支持批量生成多个密码
- 支持排除易混淆字符（如 `i`, `l`, `1`, `L`, `o`, `0`, `O`）
- 保证每种启用的字符类型至少出现一次
- 自动评估密码强度（弱 / 中 / 强 / 极强）并计算熵值
- 交互式生成模式
- 支持保存到文件
- 彩色终端输出

## 项目结构

```
07. 命令行密码生成器/
├── generator.js   # 密码生成核心模块
├── index.js       # CLI 入口
├── package.json
└── README.md
```

## 使用方法

### 命令行参数模式

```bash
# 生成 1 个默认密码（12 位，包含大小写字母和数字）
node index.js

# 生成 20 位强密码（含符号）
node index.js -l 20 -s

# 批量生成 10 个 16 位密码
node index.js -c 10 -l 16 -s -n -u

# 排除易混淆字符
node index.js -l 16 -s -e

# 保存到文件
node index.js -c 5 -l 16 -s -o passwords.txt

# 查看帮助
node index.js -h
```

### 交互模式

```bash
node index.js -i
```

按提示输入即可。

### npm scripts

```bash
npm start          # 默认密码
npm run strong     # 20 位强密码
npm run batch      # 批量生成 10 个 16 位强密码
npm run interactive # 交互模式
```

## 命令行选项

| 短选项 | 长选项              | 说明                     |
| ------ | ------------------- | ------------------------ |
| `-l`   | `--length <n>`      | 密码长度（默认 12）      |
| `-c`   | `--count <n>`       | 生成数量（默认 1）       |
| `-L`   | `--lower`           | 包含小写字母             |
| `-u`   | `--upper`           | 包含大写字母             |
| `-n`   | `--number`          | 包含数字                 |
| `-s`   | `--symbol`          | 包含特殊符号             |
| `-e`   | `--exclude-similar` | 排除易混淆字符 `il1Lo0O` |
| `-i`   | `--interactive`     | 进入交互模式             |
| `-o`   | `--output <file>`   | 保存到指定文件           |
| `-h`   | `--help`            | 显示帮助                 |

> 未显式指定任何字符类型时，默认启用 **小写+大写+数字**。

## 密码强度评估

强度评估综合考虑两个维度：

1. **长度**：≥8、≥12、≥16、≥20 各加 1 分
2. **字符多样性**：包含小写、大写、数字、符号 各加 1 分

| 总分 | 等级 |
| ---- | ---- |
| 0-3  | 弱   |
| 4-5  | 中   |
| 6-7  | 强   |
| 8    | 极强 |

同时输出**熵值（bits）**，计算公式：`长度 × log2(字符集大小)`，可作为密码强度的数学度量。

## 安全说明

- 使用 Node.js `crypto.randomBytes()` 生成随机数，属于**加密安全的伪随机数生成器（CSPRNG）**
- 通过拒绝采样（rejection sampling）消除取模偏差，保证字符分布均匀
- 使用 Fisher-Yates 洗牌算法保证强制注入字符的位置随机

## 作为模块使用

`generator.js` 也可独立作为模块导入：

```javascript
const {
  generatePassword,
  generateBatch,
  evaluateStrength,
} = require("./generator");

const pwd = generatePassword({
  length: 16,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: true,
});

console.log(pwd);
console.log(evaluateStrength(pwd));
```

## 运行环境

- Node.js >= 12.x（依赖 `crypto.randomInt`）
- 无任何第三方依赖
