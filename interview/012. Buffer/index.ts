// buffer-demo.js

// 1. Buffer.from()：字符串转二进制Buffer
const buf1 = Buffer.from('Hello 中国');
console.log('buf1:', buf1); // 打印原始字节 <Buffer 48 65 6c 6c 6f 20 e4 b8 ad e5 9b bd>

// 2. Buffer 转回 utf‑8 字符串
const str1 = buf1.toString('utf8');
console.log('buf1转字符串：', str1); // Hello 中国

// 3. 转 base64 / hex 十六进制
console.log('base64:', buf1.toString('base64'));
console.log('hex:', buf1.toString('hex'));

// 4. Buffer.alloc() 分配指定字节内存，初始化为0
const buf2 = Buffer.alloc(6);
buf2[0] = 0x41; // A 的 ascii 码
buf2[1] = 0x42; // B
console.log('buf2:', buf2);
console.log('buf2字符串:', buf2.toString()); // AB

// 5. Buffer.concat 拼接多个Buffer（流场景常用）
const b1 = Buffer.from('你');
const b2 = Buffer.from('好');
const totalBuf = Buffer.concat([b1, b2]);
console.log('拼接结果：', totalBuf.toString()); // 你好

// 6. 遍历每个字节
const buf3 = Buffer.from('AB');
for (let i = 0; i < buf3.length; i++) {
  console.log(`第${i}字节：`, buf3[i]); // 输出字节数值 65，66
}

// 7. 读取文件得到Buffer示例（你本地随便放一个txt文件）
import fs from 'node:fs';
try {
  // 不传入编码，返回Buffer
  const fileBuf = fs.readFileSync('./test.txt');
  console.log('文件二进制：', fileBuf);
  console.log('文件文本：', fileBuf.toString('utf8'));
} catch (e) {
  console.log('提示：创建 test.txt 文件才能运行文件读取部分');
}
