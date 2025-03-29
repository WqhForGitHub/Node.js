# 常见的 node.js 核心模块

- **`assert: 提供断言测试功能。`** 
- **`async_hooks: 跟踪异步资源的生命周期。`** 
- **`buffer: 处理二进制数据流。`** 
- **`child_process: 衍生子进程。`** 
- **`cluster: 创建共享端口的多进程服务器。`** 
- **`console: 提供控制台调试工具。`** 
- **`crypto: 提供加密和解密功能。`** 
- **`dgram: 提供 UDP 数据报套接字。`** 
- **`dns: 提供域名解析功能。`** 
- **`events: 提供事件发布和订阅机制。`** 
- **`fs: 提供文件系统操作功能。`** 
- **`http: 创建 HTTP 服务器和客户端。`** 
- **`http2: 创建 HTTP/2 服务器和客户端。`** 
- **`https: 创建 HTTPS 服务器和客户端。`** 
- **`inspector: 提供调试工具。`** 
- **`module: 提供模块加载和管理功能。`** 
- **`net: 提供 TCP 套接字。`** 
- **`os: 提供操作系统信息。`** 
- **`path: 提供路径操作功能。`** 
- **`perf_hooks: 提供性能分析工具。`** 
- **`process: 提供当前 Node.js 进程的信息和控制。`** 
- **`punycode: 提供 Punycode 编码和解码功能。`** 
- **`querystring: 提供查询字符串解析和格式化功能。`** 
- **`readline: 提供逐行读取流的功能。`** 
- **`repl: 提供交互式解释器环境。`** 
- **`stream: 提供流操作功能。`** 
- **`string_decoder: 提供字符串解码功能。`** 
- **`timers: 提供定时器功能。`** 
- **`tls: 提供 TLS/SSL 加密功能。`** 
- **`trace_events: 提供跟踪事件功能。`** 
- **`tty: 提供终端操作功能。`** 
- **`url: 提供 URL 解析和格式化功能。`** 
- **`util: 提供实用工具函数。`** 
- **`v8: 提供 V8 引擎信息。`** 
- **`vm: 提供虚拟机环境。`** 
- **`wasi: 提供 WebAssembly 系统接口。`** 
- **`worker_threads: 提供多线程功能。`** 
- **`zlib: 提供压缩和解压缩功能。`** 

<br>

<br>

# path

```javascript
const path = require('node:path');

// path.join
const joinedPath = path.join('/foo', 'bar', 'baz/asdf', 'quux', '..');
console.log(`path.join result: ${joinedPath}`);

// path.resolve
const resolvedPath = path.resolve('/foo', 'bar', '/baz/asdf', 'quux', '..');
console.log(`path.resolve result: ${resolvedPath}`);

// path.basename
const baseName = path.basename('/foo/bar/baz/asdf/quux.html');
console.log(`path.basename result: ${baseName}`);

const baseNameWithoutExt = path.basename('/foo/bar/baz/asdf/quux.html', '.html');
console.log(`path.basename without extension result: ${baseNameWithoutExt}`);

// path.dirname
const dirName = path.dirname('/foo/bar/baz/asdf/quux');
console.log(`path.dirname result: ${dirName}`);

// path.extname
const extName = path.extname('index.html');
console.log(`path.extname result: ${extName}`);

// path.normalize
const normalizedPath = path.normalize('/foo/bar//baz/asdf/quux/..');
console.log(`path.normalize result: ${normalizedPath}`);

// path.isAbsolute
const absolutePath = '/foo/bar';
console.log(`path.isAbsolute('${absolutePath}') result: ${path.isAbsolute(absolutePath)}`);

const relativePath = 'foo/bar';
console.log(`path.isAbsolute('${relativePath}') result: ${path.isAbsolute(relativePath)}`);

// path.sep
console.log(`path.sep result: ${path.sep}`);

// path.delimiter
console.log(`path.delimiter result: ${path.delimiter}`);

// path.format
const pathObject = {
  root: '/ignored',
  dir: '/home/user/dir',
  base: 'file.txt',
};
console.log(`path.format result: ${path.format(pathObject)}`);

// path.parse
const parsedPath = path.parse('/home/user/dir/file.txt');
console.log('path.parse result:');
console.log(parsedPath);

// path.toNamespacedPath (仅 Windows)
if (process.platform === 'win32') {
  const namespacedPath = path.toNamespacedPath('C:\\foo\\bar');
  console.log(`path.toNamespacedPath result: ${namespacedPath}`);
} else {
  console.log('path.toNamespacedPath is only available on Windows.');
}
```

<br>

<br>

# fs

```javascript
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

// 异步读取文件
fs.readFile('example.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件出错:', err);
    return;
  }
  console.log('文件内容 (异步):', data);
});

// 异步写入文件
const content = 'Hello, Node.js!';
fs.writeFile('example.txt', content, err => {
  if (err) {
    console.error('写入文件出错:', err);
    return;
  }
  console.log('文件写入成功 (异步)');
});

// 异步追加内容到文件
const appendContent = '\nThis is appended content.';
fs.appendFile('example.txt', appendContent, err => {
  if (err) {
    console.error('追加文件出错:', err);
    return;
  }
  console.log('文件追加成功 (异步)');
});

// 异步创建目录
fs.mkdir('new_directory', err => {
  if (err) {
    console.error('创建目录出错:', err);
    return;
  }
  console.log('目录创建成功 (异步)');
});

// 异步读取目录内容
fs.readdir('new_directory', (err, files) => {
  if (err) {
    console.error('读取目录出错:', err);
    return;
  }
  console.log('目录内容 (异步):', files);
});

// 异步重命名文件
fs.rename('example.txt', 'new_example.txt', err => {
  if (err) {
    console.error('重命名出错:', err);
    return;
  }
  console.log('重命名成功 (异步)');
});

// 异步获取文件状态
fs.stat('new_example.txt', (err, stats) => {
  if (err) {
    console.error('获取文件状态出错:', err);
    return;
  }
  console.log('文件大小 (异步):', stats.size);
  console.log('是否为文件 (异步):', stats.isFile());
  console.log('是否为目录 (异步):', stats.isDirectory());
});

// 异步删除文件
fs.unlink('new_example.txt', err => {
  if (err) {
    console.error('删除文件出错:', err);
    return;
  }
  console.log('文件删除成功 (异步)');
});

// 异步删除目录
fs.rmdir('new_directory', err => {
  if (err) {
    console.error('删除目录出错:', err);
    return;
  }
  console.log('目录删除成功 (异步)');
});

// 使用 promises 的方式读取文件
fsPromises.readFile('example.txt', 'utf8')
  .then(data => console.log('文件内容 (Promises):', data))
  .catch(err => console.error('读取文件出错 (Promises):', err));
```

<br>

<br>

# console

```javascript
// console.log
console.log('Hello, world!');

// console.error
console.error('An error occurred!');

// console.warn
console.warn('This is a warning message.');

// console.info
console.info('This is an informational message.');

// console.debug
console.debug('This is a debug message.');

// console.assert
console.assert(1 === 2, '1 is not equal to 2');

// console.time and console.timeEnd
console.time('My Timer');
for (let i = 0; i < 1000000; i++) {
  // ...
}
console.timeEnd('My Timer');

// console.count and console.countReset
function myFunction() {
  console.count('myFunction called');
}

myFunction();
myFunction();
console.countReset('myFunction called');
myFunction();

// console.table
const users = [
  { name: 'Alice', age: 30, city: 'New York' },
  { name: 'Bob', age: 25, city: 'Los Angeles' },
  { name: 'Charlie', age: 35, city: 'Chicago' }
];
console.table(users);

// console.group, console.groupCollapsed, and console.groupEnd
console.group('My Group');
console.log('Message 1');
console.log('Message 2');
  console.group('My Subgroup');
  console.log('Submessage 1');
  console.log('Submessage 2');
  console.groupEnd();
console.groupEnd();
```

<br>

<br>

# http

```javascript
const http = require('node:http');

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the homepage!\n');
  } else if (req.url === '/about' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>About Us</h1><p>This is the about page.</p>');
  } else if (req.url === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = { message: 'Hello, JSON!' };
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n');
  }
});

// 监听端口
const port = 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

// 创建 HTTP 客户端
const options = {
  hostname: 'www.example.com',
  port: 80,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);

  res.on('data', (chunk) => {
    console.log('Body:', chunk.toString());
  });

  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error);
});

req.end();
```

<br>

<br>

# https

```javascript
const fs = require('node:fs');
const https = require('node:https');

// 创建 HTTPS 服务器
const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem')
};

const server = https.createServer(options, (req, res) => {
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);

  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the homepage!\n');
  } else if (req.url === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const data = { message: 'Hello, JSON!' };
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n');
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`HTTPS server running at https://localhost:${port}/`);
});

// 创建 HTTPS 客户端
const clientOptions = {
  hostname: 'www.example.com',
  port: 443,
  path: '/',
  method: 'GET'
};

const req = https.request(clientOptions, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);

  res.on('data', (chunk) => {
    console.log('Body:', chunk.toString());
  });

  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error);
});

req.end();
```

<br>

<br>

# TCP net

```javascript
const net = require('node:net');

// 创建 TCP 服务器
const server = net.createServer((socket) => {
  console.log('Client connected');

  socket.on('data', (data) => {
    console.log('Received data:', data.toString());
    socket.write('Echo: ' + data.toString()); // 将数据回显给客户端
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`TCP server listening on port ${port}`);
});

// 创建 TCP 客户端
const client = net.createConnection({ port: 3000 }, () => {
  console.log('Connected to server');
  client.write('Hello, server!');
});

client.on('data', (data) => {
  console.log('Received:', data.toString());
  client.end(); // 关闭连接
});

client.on('end', () => {
  console.log('Disconnected from server');
});

client.on('error', (err) => {
  console.error('Client error:', err);
});
```

<br>

<br>

# UDP dgram

```javascript
const dgram = require('node:dgram');

// 创建 UDP socket
const socket = dgram.createSocket('udp4');

socket.on('message', (msg, rinfo) => {
  console.log(`Received message: ${msg} from ${rinfo.address}:${rinfo.port}`);
});

socket.on('error', (err) => {
  console.error(`Socket error: ${err}`);
  socket.close();
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`Socket listening on ${address.address}:${address.port}`);
});

socket.on('close', () => {
  console.log('Socket closed');
});

// 绑定 socket
const port = 41234;
socket.bind(port, () => {
  console.log(`Socket bound to port ${port}`);
});

// 发送数据报
const message = Buffer.from('Hello, UDP!');
const address = 'localhost';

socket.send(message, port, address, (err) => {
  if (err) {
    console.error(`Error sending message: ${err}`);
  } else {
    console.log(`Message sent to ${address}:${port}`);
  }
});

setTimeout(() => {
  socket.close();
}, 1000);
```

<br>

<br>

# dns

```javascript
const dns = require('node:dns');

// dns.lookup
dns.lookup('example.com', (err, address, family) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('address:', address);
  console.log('family:', family);
});

// dns.lookup with options
dns.lookup('example.com', { family: 4, all: true }, (err, addresses) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('addresses:', addresses);
});

// dns.resolve
dns.resolve('example.com', 'A', (err, addresses) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('addresses:', addresses);
});

// dns.resolve4
dns.resolve4('example.com', (err, addresses) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('addresses:', addresses);
});

// dns.reverse
dns.reverse('8.8.8.8', (err, hostnames) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('hostnames:', hostnames);
});

// dns.getServers and dns.setServers
const servers = dns.getServers();
console.log('DNS servers:', servers);

dns.setServers(['8.8.8.8', '1.1.1.1']);
const newServers = dns.getServers();
console.log('New DNS servers:', newServers);
```

<br>

<br>

# url

```javascript
// 使用 URL 类
const myURL = new URL('https://user:pass@sub.example.com:8080/p/a/t/h?query=string#hash');

console.log(myURL.href);
console.log(myURL.origin);
console.log(myURL.protocol);
console.log(myURL.username);
console.log(myURL.password);
console.log(myURL.host);
console.log(myURL.hostname);
console.log(myURL.port);
console.log(myURL.pathname);
console.log(myURL.search);
console.log(myURL.searchParams);
console.log(myURL.hash);

// 使用 URLSearchParams 类
const myURL2 = new URL('https://example.com/?foo=bar&baz=qux');
const params = myURL2.searchParams;

console.log(params.get('foo'));
console.log(params.has('baz'));

params.append('abc', 'xyz');
console.log(myURL2.href);

params.set('foo', 'newvalue');
console.log(myURL2.href);

params.delete('baz');
console.log(myURL2.href);

// 构造 URL
const myURL3 = new URL('https://example.com');
myURL3.pathname = '/a/b/c';
myURL3.search = '?d=e';
myURL3.hash = '#fgh';

console.log(myURL3.href);

// 使用模板字符串构造 URL
const pathname = '/a/b/c';
const search = '?d=e';
const hash = '#fgh';
const myURL4 = new URL(`https://example.com${pathname}${search}${hash}`);

console.log(myURL4.href);

// 遗留 API (不推荐使用)
const urlString = 'https://user:pass@sub.example.com:8080/p/a/t/h?query=string#hash';
const urlObject = url.parse(urlString);

console.log(urlObject);
console.log(url.format(urlObject));
```

<br>

<br>

# URL 查询字符串 querystring

```javascript
const querystring = require('node:querystring');
const url = require('node:url');

// querystring 模块
const qs = 'foo=bar&abc=xyz&abc=123';
const parsed = querystring.parse(qs);
console.log('querystring.parse:', parsed);

const obj = { foo: 'bar', abc: ['xyz', '123'] };
const stringified = querystring.stringify(obj);
console.log('querystring.stringify:', stringified);

const str = 'name=中文&url=https://example.com?q=中文';
const escaped = querystring.escape(str);
console.log('querystring.escape:', escaped);
const unescaped = querystring.unescape(escaped);
console.log('querystring.unescape:', unescaped);

// URLSearchParams API
const params1 = new URLSearchParams('foo=bar&abc=xyz&abc=123');
console.log('URLSearchParams from string:', params1.toString());

const params2 = new URLSearchParams({ foo: 'bar', abc: ['xyz', '123'] });
console.log('URLSearchParams from object:', params2.toString());

const myURL = new URL('https://example.com/?foo=bar&abc=xyz&abc=123');
const params3 = myURL.searchParams;
console.log('URLSearchParams from URL:', params3.toString());

console.log('URLSearchParams.get:', params3.get('foo'));
console.log('URLSearchParams.getAll:', params3.getAll('abc'));
console.log('URLSearchParams.has:', params3.has('def'));

params3.append('def', 'ghi');
console.log('URLSearchParams.append:', params3.toString());

params3.set('abc', 'newvalue');
console.log('URLSearchParams.set:', params3.toString());

params3.delete('foo');
console.log('URLSearchParams.delete:', params3.toString());
```

<br>

<br>

# 流操作 stream

```javascript
const fs = require('node:fs');
const stream = require('node:stream');
const { Transform } = stream;

// 创建可读流
const readableStream = fs.createReadStream('input.txt', { encoding: 'utf8' });

readableStream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes of data.`);
});

readableStream.on('end', () => {
  console.log('Finished reading the file.');
});

readableStream.on('error', (err) => {
  console.error(`An error occurred: ${err}`);
});

// 创建可写流
const writableStream = fs.createWriteStream('output.txt', { encoding: 'utf8' });

writableStream.write('Hello, stream!\n');
writableStream.write('This is some more data.\n');
writableStream.end('Finished writing the file.\n');

writableStream.on('finish', () => {
  console.log('Finished writing to the file.');
});

writableStream.on('error', (err) => {
  console.error(`An error occurred: ${err}`);
});

// 管道
const readableStream2 = fs.createReadStream('input.txt');
const writableStream2 = fs.createWriteStream('output2.txt');

readableStream2.pipe(writableStream2);

writableStream2.on('finish', () => {
  console.log('Finished copying the file.');
});

writableStream2.on('error', (err) => {
  console.error(`An error occurred: ${err}`);
});

// 转换流
class UppercaseTransform extends Transform {
  constructor(options) {
    super(options);
  }

  _transform(chunk, encoding, callback) {
    const transformedChunk = chunk.toString().toUpperCase();
    this.push(transformedChunk);
    callback();
  }
}

const uppercaseTransform = new UppercaseTransform();

const readableStream3 = fs.createReadStream('input.txt');
const writableStream3 = fs.createWriteStream('output3.txt');

readableStream3.pipe(uppercaseTransform).pipe(writableStream3);

writableStream3.on('finish', () => {
  console.log('Finished transforming and copying the file.');
});

writableStream3.on('error', (err) => {
  console.error(`An error occurred: ${err}`);
});

// 异步迭代器
async function processStream() {
  const readableStream4 = fs.createReadStream('input.txt', { encoding: 'utf8' });

  for await (const chunk of readableStream4) {
    console.log(`Received ${chunk.length} bytes of data (async iterator).`);
  }

  console.log('Finished reading the file (async iterator).');
}

processStream().catch((err) => {
  console.error(`An error occurred: ${err}`);
});
```

<br>

<br>

# 逐行读取 readline

```javascript
const readline = require('node:readline');
const fs = require('node:fs');
const { stdin: input, stdout: output } = require('node:process');

// 从控制台逐行读取
const rl1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'Enter text here > ',
});

rl1.prompt();

rl1.on('line', (line) => {
  console.log(`You entered: ${line}`);
  rl1.prompt();
}).on('close', () => {
  console.log('Bye!');
  process.exit(0);
});

// 从文件逐行读取
async function processLineByLine() {
  const fileStream = fs.createReadStream('input.txt');

  const rl2 = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // 识别所有 CR LF 行结束符
  });
  // 注意：使用 crlfDelay 选项来正确处理 Windows 换行符 (\r\n)

  for await (const line of rl2) {
    // 文件中的每一行都将在此处作为 `line` 传递
    console.log(`Line from file: ${line}`);
  }
}

processLineByLine();

// 使用 readline/promises API (Node.js 17+)
async function main() {
  const rl3 = readline.createInterface({ input, output });

  try {
    const answer = await rl3.question('What do you think of Node.js? ');
    console.log(`Thank you for your valuable feedback: ${answer}`);
  } finally {
    rl3.close();
  }
}

main();
```

<br>

<br>

# 进程相关 process

```javascript
// 命令行参数
console.log('process.argv:', process.argv);

// 环境变量
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);

// 当前工作目录
console.log('process.cwd():', process.cwd());

// 进程 ID
console.log('process.pid:', process.pid);

// 操作系统平台
console.log('process.platform:', process.platform);

// 内存使用情况
console.log('process.memoryUsage():', process.memoryUsage());

// CPU 使用情况
console.log('process.cpuUsage():', process.cpuUsage());

// 监听 exit 事件
process.on('exit', (code) => {
  console.log(`Process exited with code: ${code}`);
});

// 监听 SIGINT 事件
process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Exiting gracefully...');
  process.exit(0);
});

// 监听 uncaughtException 事件
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// 使用 process.nextTick
console.log('Start');

process.nextTick(() => {
  console.log('process.nextTick callback');
});

console.log('End');

// 模拟一个错误
// setTimeout(() => {
//   throw new Error('Simulated error');
// }, 1000);

// 退出进程
// process.exit(0);
```

<br>

<br>

# 子进程 child

```javascript
const { spawn, exec, fork } = require('node:child_process');

// child_process.spawn()
const ls = spawn('ls', ['-lh', '/usr']);

ls.stdout.on('data', (data) => {
  console.log(`stdout (spawn): ${data}`);
});

ls.stderr.on('data', (data) => {
  console.error(`stderr (spawn): ${data}`);
});

ls.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

// child_process.exec()
exec('ls -lh /usr', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout (exec): ${stdout}`);
  console.error(`stderr (exec): ${stderr}`);
});

// child_process.fork()
// parent.js
const child = fork('child.js');

child.on('message', (msg) => {
  console.log('Message from child:', msg);
});

child.send({ hello: 'world' });

// child.js
// process.on('message', (msg) => {
//   console.log('Message from parent:', msg);
//   process.send({ answer: 42 });
// });
```

<br>

<br>

# 二进制数据 buffer

```javascript
// 创建 Buffer
const buf1 = Buffer.from([0x62, 0x75, 0x66, 0x66, 0x65, 0x72]);
console.log('Buffer.from(array):', buf1.toString());

const buf2 = Buffer.from('hello world', 'ascii');
console.log('Buffer.from(string, encoding):', buf2.toString('hex'));
console.log('Buffer.from(string, encoding):', buf2.toString('base64'));

const buf3 = Buffer.alloc(5);
console.log('Buffer.alloc(size):', buf3);

const buf4 = Buffer.alloc(5, 'a');
console.log('Buffer.alloc(size, fill):', buf4);

const buf5 = Buffer.allocUnsafe(10);
console.log('Buffer.allocUnsafe(size):', buf5);

// 写入 Buffer
const buf6 = Buffer.alloc(256);
const len = buf6.write('Simply Easy Learning');
console.log('buf.write(string):', `Bytes written : ${len}`);

// 读取 Buffer
const buf7 = Buffer.alloc(26);
for (let i = 0 ; i < 26 ; i++) {
  buf7[i] = i + 97;
}
console.log('buf.toString(encoding):', buf7.toString('ascii'));
console.log('buf.toString(encoding, start, end):', buf7.toString('ascii',0,5));

// Buffer.concat
const buf8 = Buffer.from('hello ');
const buf9 = Buffer.from('world');
const buf10 = Buffer.concat([buf8, buf9]);
console.log('Buffer.concat(list):', buf10.toString());

// buf.copy
const buf11 = Buffer.allocUnsafe(26);
for (let i = 0 ; i < 26 ; i++) {
  buf11[i] = i + 97;
}
const buf12 = Buffer.allocUnsafe(3);
buf12.copy(buf11, 0, 0, 3);
console.log('buf.copy(target, targetStart, sourceStart, sourceEnd):', buf11.toString('ascii', 0, 5));

// buf.slice
const buf13 = Buffer.from('buffer');
const buf14 = buf13.slice(0, 3);
console.log('buf.slice(start, end):', buf14.toString());

// buf.length
const buf15 = Buffer.from('test');
console.log('buf.length:', buf15.length);
```

<br>

<br>

# 二进制解码 string_decoder

```javascript
const { StringDecoder } = require('node:string_decoder');

// 基本用法
const decoder1 = new StringDecoder('utf8');
const cent = Buffer.from([0xC2, 0xA2]);
console.log('decoder1.write(cent):', decoder1.write(cent));

const euro = Buffer.from([0xE2, 0x82, 0xAC]);
console.log('decoder1.write(euro):', decoder1.write(euro));

// 处理不完整的 UTF-8 字符
const decoder2 = new StringDecoder('utf8');
decoder2.write(Buffer.from([0xE2]));
decoder2.write(Buffer.from([0x82]));
console.log('decoder2.end(Buffer.from([0xAC])):', decoder2.end(Buffer.from([0xAC])));

// 逐字节解码 UTF-8 字符
const decoder3 = new StringDecoder('utf8');
const buffer = Buffer.from('This is a test €');
let result = '';

for (let i = 0; i < buffer.length; i++) {
  result += decoder3.write(buffer.slice(i, i + 1));
}

result += decoder3.end();
console.log('逐字节解码 UTF-8 字符:', result);
```

<br>

<br>

# 事件机制 events

```javascript
const EventEmitter = require('node:events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

// 注册监听器
myEmitter.on('event', () => {
  console.log('An event occurred!');
});

// 注册带参数的监听器
myEmitter.on('eventWithArgs', (a, b) => {
  console.log(`Event with arguments: ${a}, ${b}`);
});

// 注册单次监听器
myEmitter.once('onceEvent', () => {
  console.log('This is a one-time event!');
});

// 触发事件
myEmitter.emit('event');
myEmitter.emit('eventWithArgs', 'hello', 'world');
myEmitter.emit('onceEvent');
myEmitter.emit('onceEvent'); // 不会再次触发

// 错误处理
myEmitter.on('error', (err) => {
  console.error('An error occurred:', err);
});

myEmitter.on('eventWithError', () => {
  throw new Error('Simulated error');
});

// 触发错误事件
// myEmitter.emit('eventWithError'); // 触发 'error' 事件

// 移除监听器
const listener = () => {
  console.log('This listener will be removed.');
};

myEmitter.on('removeEvent', listener);
myEmitter.removeListener('removeEvent', listener);
myEmitter.emit('removeEvent'); // 不会触发

// 监听器数量
console.log('Number of listeners for event:', myEmitter.listenerCount('event'));

// 获取监听器列表
console.log('Listeners for event:', myEmitter.listeners('event'));
```

<br>

<br>

# 实用工具模块 util

```javascript
const util = require('node:util');
const fs = require('node:fs');

// util.callbackify
async function fn() {
  return 'hello world';
}

const callbackFunction = util.callbackify(fn);

callbackFunction((err, ret) => {
  if (err) throw err;
  console.log('util.callbackify:', ret);
});

// util.debuglog
const debuglog = util.debuglog('myapp');
debuglog('hello from myapp [%d]', 123);

// util.deprecate
const deprecatedFn = util.deprecate(() => {
  console.log('deprecatedFn called');
}, 'deprecatedFn() is deprecated. Use newFn() instead.');

deprecatedFn();

// util.format
console.log('util.format:', util.format('%s:%s', 'foo', 'bar', 'baz'));

// util.inspect
const obj = { a: 1, b: { c: 2 } };
console.log('util.inspect:', util.inspect(obj, { depth: null, colors: true }));

// util.isDeepStrictEqual
const obj1 = { a: 1, b: { c: 2 } };
const obj2 = { a: 1, b: { c: 2 } };
console.log('util.isDeepStrictEqual:', util.isDeepStrictEqual(obj1, obj2));

// util.promisify
const readFile = util.promisify(fs.readFile);

async function read() {
  try {
    const data = await readFile('myfile.txt', 'utf8');
    console.log('util.promisify:', data);
  } catch (err) {
    console.error(err);
  }
}

// read(); // 确保存在名为 myfile.txt 的文件

// util.types
console.log('util.types.isDate:', util.types.isDate(new Date()));
console.log('util.types.isMap:', util.types.isMap(new Map()));
```

<br>

<br>

# 数据加密 crypto

```javascript
const crypto = require('node:crypto');

// 哈希 (Hashing)
const hash = crypto.createHash('sha256');
hash.update('some data to hash');
console.log('Hash:', hash.digest('hex'));

// HMAC (消息认证码)
const hmac = crypto.createHmac('sha256', 'secret key');
hmac.update('some data to hash');
console.log('HMAC:', hmac.digest('hex'));

// 对称加密 (Symmetric Encryption)
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}

function decrypt(encryptedData) {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const encryptedText = Buffer.from(encryptedData.encryptedData, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const message = 'This is a secret message';
const encrypted = encrypt(message);
const decrypted = decrypt(encrypted);

console.log('Original message:', message);
console.log('Encrypted message:', encrypted);
console.log('Decrypted message:', decrypted);

// 非对称加密 (Asymmetric Encryption)
crypto.generateKeyPair('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
}, (err, publicKey, privateKey) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Public key:', publicKey);
  console.log('Private key:', privateKey);

  // 使用公钥加密
  const encryptedData = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
    data: Buffer.from('secret data')
  }, publicKey);

  console.log('encrypted data: ', encryptedData.toString('hex'));

  // 使用私钥解密
  const decryptedData = crypto.privateDecrypt({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
    data: encryptedData
  }, privateKey);

  console.log('decrypted data: ', decryptedData.toString());
});

// 密钥派生函数 (KDF)
const password = 'my secret password';
const salt = crypto.randomBytes(16).toString('hex');

crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) throw err;
  console.log('Derived key:', derivedKey.toString('hex'));
});
```

<br>

<br>

# md5 及其 crypto

```javascript
const crypto = require('node:crypto');

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  const hash = crypto.createHash('md5');
  hash.update(salt + password);
  return hash.digest('hex');
}

const password = 'mysecretpassword';
const salt = generateSalt();
const hashedPassword = hashPassword(password, salt);

console.log(`密码: ${password}`);
console.log(`盐值: ${salt}`);
console.log(`加盐后的哈希值: ${hashedPassword}`);
```

<br>

<br>

# 资源压缩 zlib

```javascript
const zlib = require('node:zlib');
const fs = require('node:fs');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');

// 使用 Gzip 压缩文件
async function gzipFile(input, output) {
  const gzip = zlib.createGzip();
  const source = fs.createReadStream(input);
  const destination = fs.createWriteStream(output);
  await pipeline(source, gzip, destination);
  console.log(`File ${input} compressed to ${output}`);
}

// 使用 Gzip 解压缩文件
async function gunzipFile(input, output) {
  const gunzip = zlib.createGunzip();
  const source = fs.createReadStream(input);
  const destination = fs.createWriteStream(output);
  await pipeline(source, gunzip, destination);
  console.log(`File ${input} decompressed to ${output}`);
}

// 使用 Brotli 压缩数据
async function brotliCompressData(data) {
  const brotliCompress = promisify(zlib.brotliCompress);
  const compressedData = await brotliCompress(data);
  console.log('Brotli compressed data:', compressedData.toString('base64'));
}

// 使用 Brotli 解压缩数据
async function brotliDecompressData(data) {
  const brotliDecompress = promisify(zlib.brotliDecompress);
  const decompressedData = await brotliDecompress(Buffer.from(data, 'base64'));
  console.log('Brotli decompressed data:', decompressedData.toString());
}

// 示例
async function main() {
  // 创建一个示例文件
  fs.writeFileSync('input.txt', 'This is some sample text for compression.');

  // Gzip 压缩和解压缩
  await gzipFile('input.txt', 'input.txt.gz');
  await gunzipFile('input.txt.gz', 'output.txt');

  // Brotli 压缩和解压缩
  const sampleData = 'This is some sample text for Brotli compression.';
  await brotliCompressData(sampleData);
  await brotliDecompressData('GyXkADkAYAcA0wIAJhUAKAAA'); // 上面压缩后的数据
}

main().catch((err) => {
  console.error('An error occurred:', err);
  process.exitCode = 1;
});
```

<br>

<br>

# 集群 cluster

```javascript
const cluster = require('node:cluster');
const http = require('node:http');
const { availableParallelism } = require('node:os');
const process = require('node:process');

const numCPUs = availableParallelism();

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();

    worker.on('message', (msg) => {
      console.log(`Primary received message from worker ${worker.process.pid}:`, msg);
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    cluster.fork(); // 自动重启 worker
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`hello world from worker ${process.pid}\n`);
    process.send({ message: `Request handled by worker ${process.pid}` });
  }).listen(8000);

  console.log(`Worker ${process.pid} started`);
}
```

<br>

<br>

# os

```javascript
const os = require('node:os');

console.log('EOL:', os.EOL === '\n' ? 'Unix' : 'Windows');
console.log('可用并行量:', os.availableParallelism());
console.log('CPU 架构:', os.arch());
console.log('CPU 信息:', os.cpus());
console.log('空设备文件:', os.devNull);
console.log('字节序:', os.endianness());
console.log('空闲内存:', os.freemem());
console.log('Home 目录:', os.homedir());
console.log('主机名:', os.hostname());
console.log('操作系统平台:', os.platform());
console.log('操作系统版本:', os.release());
console.log('临时目录:', os.tmpdir());
console.log('总内存:', os.totalmem());
console.log('操作系统类型:', os.type());
console.log('运行时间:', os.uptime());
console.log('用户信息:', os.userInfo());
console.log('操作系统内核版本:', os.version());
```

<br>

<br>

# socket

```javascript
const http = require('node:http');
const { Server } = require('socket.io');

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Socket.IO server is running');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*', // 允许所有来源的跨域请求
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // 监听客户端发送的消息
  socket.on('chat message', (msg) => {
    console.log('Message: ' + msg);

    // 将消息广播给所有客户端
    io.emit('chat message', msg);
  });

  // 监听客户端断开连接
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

```html
<!DOCTYPE html>
<html>
<head>
  <title>Socket.IO Chat</title>
  <style>
    body { font: 13px Helvetica, Arial; }
    form { background: #000; padding: 3px; position: fixed; bottom: 0; width: 100%; }
    form input { border: 0; padding: 10px; width: 90%; margin-right: .5%; }
    form button { background: rgb(130, 224, 255); border: none; padding: 10px; width: 9%; }
    #messages { list-style-type: none; margin: 0; padding: 0; }
    #messages li { padding: 5px 10px; }
    #messages li:nth-child(odd) { background: #eee; }
  </style>
</head>
<body>
  <ul id="messages"></ul>
  <form id="chatForm" action="">
    <input id="m" autocomplete="off" /><button>Send</button>
  </form>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script>
    const socket = io('http://localhost:3000'); // 连接到服务器

    const form = document.getElementById('chatForm');
    const input = document.getElementById('m');
    const messages = document.getElementById('messages');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value) {
        socket.emit('chat message', input.value); // 发送消息到服务器
        input.value = '';
      }
    });

    socket.on('chat message', (msg) => {
      const item = document.createElement('li');
      item.textContent = msg;
      messages.appendChild(item);
      window.scrollTo(0, document.body.scrollHeight);
    });
  </script>
</body>
</html>
```















