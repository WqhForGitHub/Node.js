// fs 模块常用方法演示
import fs from 'fs';
import path from 'path';

// 一、同步风格
fs.writeFileSync('demo.txt', 'hello fs\n');
fs.appendFileSync('demo.txt', '第二行\n');
const content: string = fs.readFileSync('demo.txt', 'utf8'); // 传 'utf8' 返回 string，否则是 Buffer
console.log('读取:', content);
console.log('存在:', fs.existsSync('demo.txt'));

const stats: fs.Stats = fs.statSync('demo.txt');
console.log('大小:', stats.size, '是文件:', stats.isFile());

// 二、目录操作
fs.mkdirSync(path.join('fs-demo-dir', 'a', 'b'), { recursive: true }); // 相当于 mkdir -p
fs.writeFileSync('fs-demo-dir/a/b/note.txt', '嵌套文件');
console.log('目录内容:', fs.readdirSync('fs-demo-dir/a'));

fs.renameSync('demo.txt', 'demo-renamed.txt'); // 重命名/移动
fs.unlinkSync('demo-renamed.txt'); // 删文件
fs.rmSync('fs-demo-dir', { recursive: true, force: true }); // 删整个目录树

// 三、回调风格（err-first，容易嵌套）
fs.writeFile('cb.txt', 'callback style', (err) => {
  if (err) throw err;
  fs.readFile('cb.txt', 'utf8', (err, data) => {
    if (err) throw err;
    console.log('回调读取:', data);
    main(); // 只能靠回调排队执行下一步
  });
});

// 四、Promise 风格（推荐）
const fsp = fs.promises;

async function main(): Promise<void> {
  await fsp.writeFile('promise.txt', '第一行\n');
  await fsp.appendFile('promise.txt', '第二行');
  console.log('Promise 读取:', await fsp.readFile('promise.txt', 'utf8'));
  await fsp.rm('promise.txt');
  await fsp.rm('cb.txt');
}
