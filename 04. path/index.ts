// path-demo.ts —— path 模块常用方法演示
import path from 'path';

console.log('当前文件所在目录 __dirname:', __dirname);

// 1. join：拼接路径
console.log('\n--- join ---');
console.log(path.join(__dirname, 'src', 'app.js'));
console.log(path.join('/a', 'b', '..', 'c'));

// 2. resolve：转绝对路径
console.log('\n--- resolve ---');
console.log(path.resolve('app.js'));
console.log(path.resolve('/a', 'b'));

// 3. basename / dirname / extname：拆解路径
console.log('\n--- 拆解路径 ---');
const file: string = '/home/user/project/app.js';
console.log('basename:', path.basename(file));
console.log('basename(去后缀):', path.basename(file, '.js'));
console.log('dirname:', path.dirname(file));
console.log('extname:', path.extname(file));

// 4. parse：路径拆成对象
console.log('\n--- parse ---');
const parsed: path.ParsedPath = path.parse(file);
console.log(parsed);

// 5. format：parse 的反向操作
console.log('\n--- format ---');
const parts: path.FormatInputPathObject = { dir: '/home/user', base: 'app.js' };
console.log(path.format(parts));

// 6. 平台相关：sep、isAbsolute
console.log('\n--- 平台相关 ---');
const sep: string = path.sep;
console.log('sep:', JSON.stringify(sep));
console.log('isAbsolute:', path.isAbsolute('/a/b'));
console.log('isAbsolute:', path.isAbsolute('a/b'));

// 7. normalize：清理路径
console.log('\n--- normalize ---');
console.log(path.normalize('a//b/../c/./d.txt'));

// 8. 实战：安全拼接同目录文件
console.log('\n--- 实战 ---');
const configPath: string = path.join(__dirname, 'config.json');
console.log('配置文件路径:', configPath);
