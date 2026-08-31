/**
 * 多文件二进制打包器（类 ZIP）
 *
 * 简化的二进制打包格式：
 *   [Header]
 *     magic   4 bytes : "BPK1"
 *     count    4 bytes : 文件数量 (uint32 LE)
 *   [Index Entry * count]
 *     nameLen  2 bytes
 *     name     nameLen bytes (utf8)
 *     size     8 bytes (uint64 LE)
 *     offset   8 bytes (uint64 LE)
 *   [File Data ...]
 *
 * 运行：
 *   打包：npx ts-node pack.ts pack out.bpk a.txt b.txt
 *   列表：npx ts-node pack.ts list out.bpk
 *   解包：npx ts-node pack.ts unpack out.bpk [dir]
 */
import * as fs from 'fs';
import * as path from 'path';

const MAGIC = Buffer.from('BPK1', 'utf8');

function uint32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}
function uint64(n: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}
function uint16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

interface Entry {
  name: string;
  size: number;
  offset: number;
}

async function pack(outPath: string, files: string[]): Promise<void> {
  const entries: Entry[] = [];
  let headerSize = 4 + 4;
  for (const f of files) {
    const name = path.basename(f);
    const stat = fs.statSync(f);
    if (!stat.isFile()) throw new Error(`${f} 不是文件`);
    const nameBuf = Buffer.from(name, 'utf8');
    if (nameBuf.length > 65535) throw new Error(`文件名过长: ${name}`);
    const entrySize = 2 + nameBuf.length + 8 + 8;
    entries.push({ name, size: stat.size, offset: 0 });
    headerSize += entrySize;
  }

  let dataOffset = headerSize;
  for (const e of entries) {
    e.offset = dataOffset;
    dataOffset += e.size;
  }

  const out = fs.createWriteStream(outPath);
  out.write(MAGIC);
  out.write(uint32(entries.length));
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    out.write(uint16(nameBuf.length));
    out.write(nameBuf);
    out.write(uint64(e.size));
    out.write(uint64(e.offset));
  }
  for (const e of entries) {
    await new Promise<void>((resolve, reject) => {
      const r = fs.createReadStream(e.name);
      r.on('error', reject);
      r.pipe(out, { end: false });
      r.on('end', resolve);
    });
  }
  await new Promise<void>((resolve) => out.end(resolve));
  console.log(`打包完成: ${outPath}，共 ${entries.length} 个文件`);
}

function list(archive: string): Entry[] {
  const fd = fs.openSync(archive, 'r');
  try {
    const magic = Buffer.alloc(4);
    fs.readSync(fd, magic, 0, 4, 0);
    if (magic.toString('utf8') !== 'BPK1') throw new Error('不是合法的 BPK 文件');
    const countBuf = Buffer.alloc(4);
    fs.readSync(fd, countBuf, 0, 4, 4);
    const count = countBuf.readUInt32LE(0);
    let pos = 8;
    const entries: Entry[] = [];
    for (let i = 0; i < count; i++) {
      const nameLenBuf = Buffer.alloc(2);
      fs.readSync(fd, nameLenBuf, 0, 2, pos);
      pos += 2;
      const nameLen = nameLenBuf.readUInt16LE(0);
      const nameBuf = Buffer.alloc(nameLen);
      fs.readSync(fd, nameBuf, 0, nameLen, pos);
      pos += nameLen;
      const sizeOff = Buffer.alloc(16);
      fs.readSync(fd, sizeOff, 0, 16, pos);
      pos += 16;
      entries.push({
        name: nameBuf.toString('utf8'),
        size: Number(sizeOff.readBigUInt64LE(0)),
        offset: Number(sizeOff.readBigUInt64LE(8)),
      });
    }
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

function unpack(archive: string, dir: string): void {
  const entries = list(archive);
  fs.mkdirSync(dir, { recursive: true });
  const fd = fs.openSync(archive, 'r');
  try {
    for (const e of entries) {
      const buf = Buffer.alloc(e.size);
      fs.readSync(fd, buf, 0, e.size, e.offset);
      const target = path.join(dir, e.name);
      fs.writeFileSync(target, buf);
      console.log(`解出: ${target} (${e.size} bytes)`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === 'pack') {
    const [out, ...files] = rest;
    if (!out || files.length === 0) throw new Error('用法: pack <out.bpk> <file...>');
    await pack(out, files);
  } else if (cmd === 'list') {
    const [archive] = rest;
    for (const e of list(archive)) {
      console.log(`${e.name}\t${e.size}\t@${e.offset}`);
    }
  } else if (cmd === 'unpack') {
    const [archive, dir = 'unpacked'] = rest;
    unpack(archive, dir);
  } else {
    console.log('用法: pack|list|unpack ...');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
