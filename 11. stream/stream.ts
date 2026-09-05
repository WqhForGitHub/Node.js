/**
 * stream — 流式处理
 * 核心思想：数据像水流一样分批处理，不用一次性读进内存
 * 四种流：Readable（读）/ Writable（写）/ Duplex（双向）/ Transform（转换）
 */
import { Readable, Writable, Transform, pipeline } from "node:stream";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";
import path from "node:path";

// ---------- 1. 手写三种流，串成一条流水线 ----------
const source = Readable.from(["hello", "world", "stream"]); // 数据源：逐个吐出

const upper = new Transform({
  // 中间环节：小写转大写
  transform(chunk, _encoding, callback) {
    callback(null, chunk.toString().toUpperCase() + "\n");
  },
});

const sink = new Writable({
  // 终点：逐条消费
  write(chunk, _encoding, callback) {
    process.stdout.write(`[sink 收到] ${chunk}`);
    callback();
  },
});

// pipeline：自动依次连接，任一环节出错统一报给回调
pipeline(source, upper, sink, (err) => {
  console.log(err ? `出错了：${err.message}` : "1) 自定义流水线处理完成\n");
});

// ---------- 2. 实战：读文件 -> gzip 压缩 -> 写新文件（边读边压，内存占用极低） ----------
const input = path.join(__dirname, "..", "input.txt");
const output = path.join(__dirname, "..", "output.txt.gz");

pipeline(createReadStream(input), createGzip(), createWriteStream(output), (err) => {
  if (err) {
    console.error("压缩失败:", err.message);
    return;
  }
  console.log("2) 已生成压缩文件 output.txt.gz（内容是二进制，记事本打开乱码属正常）");
  console.log("   想解压回来：把 createGzip 换成 createGunzip 即可");
});
