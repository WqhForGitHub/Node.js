import { readdir, stat } from 'fs/promises';
import { join } from 'path';

// 递归统计目录大小
async function calcDirSize(dir: string): Promise<number> {
  let total = 0;
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) total += await calcDirSize(full);
    else if (ent.isFile()) total += (await stat(full)).size;
  }
  return total;
}

calcDirSize('./').then((size) => console.log(`目录大小：${(size / 1024 / 1024).toFixed(2)} MB`));
