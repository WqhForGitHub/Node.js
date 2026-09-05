/**
 * buffer — 二进制数据
 * Buffer 本质是「定长字节数组」，读文件、网络传输、流处理的底层都是它
 */
import { Buffer } from "node:buffer"; // 全局也有 Buffer，显式导入更规范

// ---------- 1. 创建：字符串 / 字节数组 / 手动分配 ----------
const b1 = Buffer.from("hello");
const b2 = Buffer.from([104, 105]);  // 104='h' 105='i'
const b3 = Buffer.alloc(4);          // 分配 4 字节并清零（安全）
const b4 = Buffer.allocUnsafe(4);    // 只分配不清零（快，但可能有残留数据）

console.log("b1:", b1);              // <Buffer 68 65 6c 6c 6f>（十六进制字节）
console.log("b2:", b2.toString());   // hi
console.log("b3:", b3);              // <Buffer 00 00 00 00>
console.log("b4（未清零）:", b4);

// ---------- 2. length 是字节数，不是字符数！ ----------
const zh = Buffer.from("你好");
console.log("\n'你好'.length =", "你好".length, "(字符)");
console.log("Buffer 字节数   =", zh.length, "(utf8 下每个汉字占 3 字节)");

// ---------- 3. 编码转换：utf8 / hex / base64 ----------
console.log("\nutf8 -> hex   :", b1.toString("hex"));
console.log("hex  -> utf8  :", Buffer.from("e4bda0e5a5bd", "hex").toString()); // 你好
console.log("utf8 -> base64:", Buffer.from("你好").toString("base64"));

// ---------- 4. 拼接与切片 ----------
const b5 = Buffer.concat([b1, Buffer.from(" world")]);
console.log("\n拼接:", b5.toString()); // hello world

const sub = b5.subarray(0, 5);
console.log("切片:", sub.toString());  // hello
sub[0] = 72;                            // 改成大写 H
console.log("subarray 共享内存，改动会影响原 buffer:", b5.toString()); // Hello world

// ---------- 5. 按二进制协议读写整数（解析文件头、网络包常用） ----------
const packet = Buffer.alloc(8);
packet.writeUInt32LE(256, 0);  // 偏移 0：小端 4 字节无符号（低位字节在前）
packet.writeInt16BE(-2, 4);    // 偏移 4：大端 2 字节有符号（高位字节在前）

console.log("\n数据包字节:", packet);
console.log("读 UInt32LE(0):", packet.readUInt32LE(0)); // 256
console.log("读 Int16BE(4) :", packet.readInt16BE(4)); // -2
