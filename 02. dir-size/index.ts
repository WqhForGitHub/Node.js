import { readdir, stat } from 'fs/promises';
import type { Dirent } from 'fs';
import { join } from 'path';

async function calcDirSize(dir: string): Promise<number> {
  let total: number = 0;
  const entries: Dirent[] = await readdir(dir, { withFileTypes: true });

  for (const ent of entries) {
    const fullPath: string = join(dir, ent.name);
    if (ent.isDirectory()) {
      total += await calcDirSize(fullPath);
    } else if (ent.isFile()) {
      const fileStat = await stat(fullPath);
      total += fileStat.size;
    }
  }

  return total;
}

calcDirSize('./').then(size => {
  console.log(`目录大小：${(size / 1024 / 1024).toFixed(2)} MB`);
})
