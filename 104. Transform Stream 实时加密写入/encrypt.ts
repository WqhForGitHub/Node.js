/**
 * Transform Stream 实时加密写入
 *
 * 自定义 Transform 流：输入明文，输出用 XOR + 偏移流得到的密文。
 * 演示 `pipeline` 串联：createReadStream → 加密 Transform → createWriteStream。
 *
 * 运行：
 *   加密：npx ts-node encrypt.ts enc plain.txt cipher.bin secretKey
 *   解密：npx ts-node encrypt.ts dec cipher.bin plain.out secretKey
 */
import * as fs from 'fs';
import { Transform, pipeline } from 'stream';

function keystream(key: Buffer, offset: number): number {
  // 简化流式密钥：根据偏移取 key 字节 + 一个伪随机扰动
  const k = key[offset % key.length];
  const noise = (offset * 1103515245 + 12345) & 0xff;
  return (k ^ noise) & 0xff;
}

class XorCipher extends Transform {
  private offset = 0;
  constructor(
    private key: Buffer,
    private encrypt: boolean
  ) {
    super();
  }
  _transform(chunk: Buffer, _enc: string, cb: () => void) {
    const out = Buffer.alloc(chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      const k = keystream(this.key, this.offset + i);
      const b = chunk[i];
      out[i] = this.encrypt ? (b ^ k) & 0xff : (b ^ k) & 0xff;
    }
    this.offset += chunk.length;
    cb();
    this.push(out);
  }
}

function run(mode: 'enc' | 'dec', input: string, output: string, keyStr: string) {
  const key = Buffer.from(keyStr, 'utf8');
  const pipelineCb = (err?: Error | null) => {
    if (err) {
      console.error('失败:', err);
      process.exit(1);
    } else {
      console.log(`${mode === 'enc' ? '加密' : '解密'}完成: ${output}`);
    }
  };
  pipeline(
    fs.createReadStream(input),
    new XorCipher(key, mode === 'enc'),
    fs.createWriteStream(output),
    pipelineCb
  );
}

const [, , mode, input, output, keyStr] = process.argv;
if ((mode !== 'enc' && mode !== 'dec') || !input || !output || !keyStr) {
  console.error('用法: ts-node encrypt.ts enc|dec <in> <out> <key>');
  process.exit(1);
}
run(mode as 'enc' | 'dec', input, output, keyStr);
