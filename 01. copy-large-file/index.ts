import fs from 'node:fs';

// GB 级别大文件：必须用 Stream 流复制，内存稳定，不会爆内存。
function copyLargeFile(src: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(src);
    const writeStream = fs.createWriteStream(dest);
    readStream.pipe(writeStream);

    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

copyLargeFile('./index.html', './b.index.html')
  .then(() => {
    console.log('复制完成');
  })
  .catch((err: Error) => console.error(err));
