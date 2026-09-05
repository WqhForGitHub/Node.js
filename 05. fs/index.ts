// fs 常用方法：同步 / 回调 / Promise 三种风格
import fs from 'fs';
import path from 'path';

// 1. 同步风格
fs.writeFileSync('demo.txt', 'hello fs\n');
fs.appendFileSync('demo.txt', '第二行\n');
console.log('读取:', fs.readFileSync('demo.txt', 'utf8')); // 传 'utf8' 返回 string
console.log('存在:', fs.existsSync('demo.txt'), '| 大小:', fs.statSync('demo.txt').size);

// 2. 目录操作
fs.mkdirSync(path.join('fs-demo-dir', 'a', 'b'), { recursive: true }); // 相当于 mkdir -p
fs.writeFileSync('fs-demo-dir/a/b/note.txt', '嵌套文件');
console.log('目录内容:', fs.readdirSync('fs-demo-dir/a'));

fs.renameSync('demo.txt', 'demo-renamed.txt'); // 重命名/移动
fs.unlinkSync('demo-renamed.txt'); // 删文件
fs.rmSync('fs-demo-dir', { recursive: true, force: true }); // 删整个目录树

// 3. 回调风格：err-first，容易嵌套
fs.writeFile('cb.txt', 'callback style', (err) => {
  if (err) throw err;
  fs.readFile('cb.txt', 'utf8', (err, data) => {
    if (err) throw err;
    console.log('回调读取:', data);
    main();
  });
});

// 4. Promise 风格（推荐）
const fsp = fs.promises;

async function main(): Promise<void> {
  await fsp.writeFile('promise.txt', '第一行\n');
  await fsp.appendFile('promise.txt', '第二行');
  console.log('Promise 读取:', await fsp.readFile('promise.txt', 'utf8'));
  await fsp.rm('promise.txt');
  await fsp.rm('cb.txt');
}
