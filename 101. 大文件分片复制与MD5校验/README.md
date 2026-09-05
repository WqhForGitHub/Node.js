# 101. 大文件分片复制与 MD5 校验

使用 Node.js 原生 `fs` 同步读写 API 按固定 chunk 分片复制大文件，复制过程中实时更新 MD5 Hash，复制完成再对目标文件做一次 MD5 校验，确保数据完整性。

## 运行

```bash
npm i -D ts-node typescript @types/node
npx ts-node copy.ts <src> <dst> [chunkSizeBytes]
```

## 要点

- `fs.openSync` + `readSync/writeSync` 指定 `offset` 实现"分片"复制，避免一次性载入内存。
- `crypto.createHash('md5')` 在复制过程中增量更新，省去二次读取源文件。
- 完成后用 `createReadStream` 对目标文件再算一次 MD5，与源 MD5 比对，保证磁盘落盘一致。