/**
 * Demo 5 - fs 文件系统（同步 / 回调）
 * 运行：node "demo/02. 核心内置模块 API/fs、fs promise/5-fs.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');

const TMP = path.join(__dirname, 'tmp'); // 当前文件所在目录下的 tmp 文件夹路径

async function fsMain(): Promise<void> {
  // 1. Sync 同步：阻塞事件循环
  fs.writeFileSync(path.join(TMP, 'a.txt'), '同步写入');
  console.log('1. 同步:', fs.readFileSync(path.join(TMP, 'a.txt'), 'utf-8'));

  // 2. Callback 回调：error-first，嵌套即回调地狱
  await new Promise<void>((resolve) => {
    fs.writeFile(path.join(TMP, 'b.txt'), '回调写入', (err) => {
      if (err) throw err;
      fs.readFile(path.join(TMP, 'b.txt'), 'utf-8', (err2, data) => {
        if (err2) throw err2;
        console.log('2. 回调:', data);
        resolve();
      });
    });
  });

  // 以下均 Sync 同步版；回调版：去 Sync 后缀、末参传 error-first 回调

  // 3. readFile 不传编码返回 Buffer
  console.log('3. Buffer:', fs.readFileSync(path.join(TMP, 'a.txt')).toString());

  // 4. appendFile 追加 / writeFile 覆盖
  fs.appendFileSync(path.join(TMP, 'app.log'), '第一行\n');
  fs.appendFileSync(path.join(TMP, 'app.log'), '第二行\n');
  console.log('4. 追加:', JSON.stringify(fs.readFileSync(path.join(TMP, 'app.log'), 'utf-8')));

  // 5. stat 文件信息
  const st = fs.statSync(path.join(TMP, 'a.txt'));
  console.log('5. stat:', st.size, '字节,', st.isFile() ? '文件' : '目录');

  // 6. mkdir 递归 / readdir 读目录
  fs.mkdirSync(path.join(TMP, 'docs', 'sub'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'docs', 'sub', 'note.md'), '# hello');
  console.log('6. 目录:', fs.readdirSync(TMP).join(', '));
  console.log('   递归:', fs.readdirSync(TMP, { recursive: true }).join(', '));

  // 7. copyFile 复制 / rename 重命名 / unlink 删除
  fs.copyFileSync(path.join(TMP, 'a.txt'), path.join(TMP, 'a.copy.txt'));
  fs.renameSync(path.join(TMP, 'a.copy.txt'), path.join(TMP, 'a.old.txt'));
  fs.unlinkSync(path.join(TMP, 'a.old.txt'));
  console.log('7. 复制 → 重命名 → 删除 完成');

  // 8. existsSync 只有同步版
  console.log('8. 还存在吗:', fs.existsSync(path.join(TMP, 'a.old.txt')));
}

// Entry 入口：建目录 → 演示 → 清理
(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  try {
    await fsMain();
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
    console.log('临时目录已清理');
  }
})();
