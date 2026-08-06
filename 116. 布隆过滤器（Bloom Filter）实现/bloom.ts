/**
 * 布隆过滤器 Bloom Filter 实现
 *
 * 位数组 + k 个相互独立的哈希函数。
 * 误判率 p ~= (1 - e^(-kn/m))^k
 *
 * 实现：使用 Buffer 模拟位数组（按字节存 8 位），
 * 哈希：sha1 取不同段当多哈希，避免引入第三方库。
 *
 * 运行：npx ts-node bloom.ts
 */
import * as crypto from 'crypto';

export class BloomFilter {
  private bits: Buffer; // 位数组（按字节）
  private n: number;    // 位数
  constructor(sizeBits: number, private k: number) {
    if (sizeBits <= 0 || k <= 0) throw new Error('invalid');
    this.n = sizeBits;
    this.bits = Buffer.alloc(Math.ceil(sizeBits / 8));
  }

  private hash(item: string): number[] {
    const out: number[] = [];
    const base = crypto.createHash('sha1').update(item).digest();
    for (let i = 0; i < this.k; i++) {
      // 复用 sha1 派生 k 个 32 位整数（足够实验用）
      const off = (i * 4) % (base.length - 4);
      const v = base.readUInt32BE(off) + i * 0x9e3779b1;
      out.push(v % this.n);
    }
    return out;
  }

  private setBit(idx: number) {
    const byte = idx >> 3;
    const mask = 1 << (idx & 7);
    this.bits[byte] |= mask;
  }
  private getBit(idx: number): boolean {
    return (this.bits[idx >> 3] & (1 << (idx & 7))) !== 0;
  }

  add(item: string) {
    for (const idx of this.hash(item)) this.setBit(idx);
  }

  mightContain(item: string): boolean {
    return this.hash(item).every((idx) => this.getBit(idx));
  }

  get bitCount() { return this.n; }
  get approxOnes(): number {
    let c = 0;
    for (const b of this.bits) c += countBits(b);
    return c;
  }
}

function countBits(b: number): number {
  let c = 0;
  while (b) { c += b & 1; b >>>= 1; }
  return c;
}

// demo
const bf = new BloomFilter(8192, 5);
const words = ['hello', 'world', 'bloom', 'filter', 'nodejs'];
for (const w of words) bf.add(w);

for (const w of words) console.log(w, '->', bf.mightContain(w));
const tests = ['hello', 'xyzz', 'filter', 'nope', 'world'];
for (const t of tests) console.log(`测试 ${t}: ${bf.mightContain(t) ? '可能在' : '一定不在'}`);
console.log('位数组中 1 的个数:', bf.approxOnes);