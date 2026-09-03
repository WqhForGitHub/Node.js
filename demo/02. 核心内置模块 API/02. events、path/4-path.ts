/**
 * Demo 4 - path 路径处理
 * 运行：node "demo/02. 核心内置模块 API/4-path.ts"（Node 22.18+）
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path') as typeof import('node:path');

// 1. join：拼接路径，自动处理分隔符（最常用），.. 回退一级
console.log(path.join('user', 'local', 'bin'), '|', path.join('a', 'b', '..', 'c'));

// 2. resolve：以工作目录为基准解析成绝对路径，遇到根路径则忽略之前的相对部分
console.log(path.resolve('demo', '4-path.ts'), '|', path.resolve('/foo', 'bar'));

// 3. basename / dirname / extname：文件名（可去掉扩展名）/ 目录名 / 扩展名
const file = '/user/local/bin/node.exe';
console.log(path.basename(file), '|', path.basename(file, '.exe')); // node.exe | node
console.log(path.dirname(file), '|', path.extname(file));

// 4. parse / format：路径字符串与对象互转
console.log(path.parse(file), '|', path.format({ dir: '/tmp', name: 'app', ext: '.js' }));

// 5. 平台相关常量：sep 路径分隔符、delimiter 环境变量分隔符（Windows 为 \ 和 ;）
console.log(JSON.stringify(path.sep), '|', JSON.stringify(path.delimiter));
console.log(path.isAbsolute('C:\\a'), '|', path.isAbsolute('a/b')); // true | false
