import fs from 'node:fs';

// GB 级大文件必须用 Stream 复制，内存稳定不爆
function copyLargeFile(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(src);
    const ws = fs.createWriteStream(dest);
    rs.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
  });
}

copyLargeFile('./index.html', './b.index.html')
  .then(() => console.log('复制完成'))
  .catch(console.error);
