# 007 - 如何使用 Node.js 读取和写入文件？

## 题目

> 如何使用 Node.js 读取和写入文件？

## 参考答案

使用内置的 **`node:fs`（File System）** 模块。它为同一个功能提供**三套风格**的 API：

```ts
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

// ---------- 1. 同步（阻塞，函数名以 Sync 结尾） ----------
const data = fs.readFileSync('./a.txt', 'utf-8');
fs.writeFileSync('./b.txt', '内容', 'utf-8');
fs.appendFileSync('./b.txt', '追加');

// ---------- 2. 异步回调（错误优先） ----------
fs.readFile('./a.txt', 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
fs.writeFile('./b.txt', '内容', (err) => {
  /* ... */
});

// ---------- 3. Promise（fs/promises，推荐配合 async/await） ----------
const data2 = await fsp.readFile('./a.txt', 'utf-8');
await fsp.writeFile('./b.txt', '内容', 'utf-8');
```

### 常用 API 速查

| API                                      | 作用                                               |
| ---------------------------------------- | -------------------------------------------------- |
| `readFile` / `readFileSync`              | 读取整个文件                                       |
| `writeFile` / `writeFileSync`            | 写入文件（**覆盖**原内容）                         |
| `appendFile` / `appendFileSync`          | 追加写入                                           |
| `mkdir` / `mkdirSync`                    | 创建目录（`{ recursive: true }` 支持多级）         |
| `readdir` / `readdirSync`                | 读取目录下文件列表                                 |
| `stat` / `statSync`                      | 获取文件信息（大小、时间、是否目录）               |
| `existsSync`                             | 判断路径是否存在（只有同步版本）                   |
| `rename`                                 | 重命名/移动                                        |
| `copyFile`                               | 复制文件                                           |
| `unlink` / `rm`                          | 删除文件 / `rm(dir, { recursive: true })` 删除目录 |
| `createReadStream` / `createWriteStream` | 流式读写（大文件必备）                             |

### 注意事项

1. **不指定 encoding 时 `readFile` 返回 `Buffer`**（二进制），指定 `'utf-8'` 才返回字符串
2. `writeFile` 是覆盖写入，需要追加用 `appendFile` 或 `flag: 'a'`
3. **大文件不要用 `readFile`**（一次性载入内存），用 `createReadStream` 流式处理
4. Web 服务器中避免使用 `*Sync` 同步 API（会阻塞事件循环）

## 示例代码说明（[index.ts](./index.ts)）

完整演示：创建目录 -> 同步写/追加/读 -> 异步回调写读 -> `fs/promises` 写/追加/读 -> 读取目录 -> 查看文件信息 -> 递归删除演示目录。

## 运行示例

```bash
npm run demo:007
```

## 常见追问

1. **readFile 和 createReadStream 的区别？**
   `readFile` 把整个文件读进内存才触发回调；`createReadStream` 分块（默认 64KB）流式处理，内存占用恒定，适合大文件。
2. **如何读取 JSON 配置文件？**
   `JSON.parse(await readFile('./config.json', 'utf-8'))`，或 CJS 中直接 `require('./config.json')`。
3. **写文件时如何避免竞争？**
   多进程写同一文件用 `flag: 'ax'`、文件锁（`proper-lockfile`）或队列化写入。
