/**
 * Demo 6 - fs/promise 文件系统（Promise / async-await）
 * 运行：node "demo/02. 核心内置模块 API/03. fs、fs promise/6-fspromise.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsp = require('node:fs/promises') as typeof import('node:fs/promises');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');

const TMP = path.join(__dirname, 'tmp');

async function main(): Promise<void> {
  // 1. writeFile / readFile：await 顺序执行，没有回调地狱
  await fsp.writeFile(path.join(TMP, 'a.txt'), 'Promise 写入');
  console.log('1. 读取:', await fsp.readFile(path.join(TMP, 'a.txt'), 'utf-8'));

  // 2. 不传编码返回 Buffer
  console.log('2. Buffer:', (await fsp.readFile(path.join(TMP, 'a.txt'))).toString());

  // 3. appendFile 追加
  await fsp.appendFile(path.join(TMP, 'app.log'), '第一行\n');
  await fsp.appendFile(path.join(TMP, 'app.log'), '第二行\n');
  console.log('3. 追加:', JSON.stringify(await fsp.readFile(path.join(TMP, 'app.log'), 'utf-8')));

  // 4. stat 文件信息
  const st = await fsp.stat(path.join(TMP, 'a.txt'));
  console.log('4. stat:', st.size, '字节,', st.isFile() ? '文件' : '目录');

  // 5. mkdir 递归 / readdir 读目录
  await fsp.mkdir(path.join(TMP, 'docs', 'sub'), { recursive: true });
  await fsp.writeFile(path.join(TMP, 'docs', 'sub', 'note.md'), '# hello');
  console.log('5. 目录:', (await fsp.readdir(TMP)).join(', '));
  console.log('   递归:', (await fsp.readdir(TMP, { recursive: true })).join(', '));

  // 6. Promise.all 并发写：回调版做不到这么干净
  await Promise.all(['x', 'y', 'z'].map((s) => fsp.writeFile(path.join(TMP, `p-${s}.txt`), s)));
  console.log('6. 并发:', (await fsp.readdir(TMP)).filter((f) => f.startsWith('p-')).join(', '));

  // 7. copyFile / rename / unlink / rm
  await fsp.copyFile(path.join(TMP, 'a.txt'), path.join(TMP, 'a.copy.txt'));
  await fsp.rename(path.join(TMP, 'a.copy.txt'), path.join(TMP, 'a.old.txt'));
  await fsp.unlink(path.join(TMP, 'a.old.txt'));
  await fsp.rm(path.join(TMP, 'docs'), { recursive: true });
  console.log('7. 复制 → 重命名 → 删除 完成');

  // 8. open 返回 FileHandle：手动控制打开 / 关闭
  const fh = await fsp.open(path.join(TMP, 'h.txt'), 'w');
  await fh.writeFile('FileHandle 写入');
  await fh.close();
  console.log('8. FileHandle:', await fsp.readFile(path.join(TMP, 'h.txt'), 'utf-8'));

  // 9. try/catch 捕获错误：替代 error-first 回调
  try {
    await fsp.readFile(path.join(TMP, '不存在.txt'), 'utf-8');
  } catch (err) {
    console.log('9. 捕获:', (err as NodeJS.ErrnoException).code);
  }
}

// Entry 入口：建目录 → 演示 → 清理
(async () => {
  await fsp.mkdir(TMP, { recursive: true });
  try {
    await main();
  } finally {
    await fsp.rm(TMP, { recursive: true, force: true });
    console.log('临时目录已清理');
  }
})();
