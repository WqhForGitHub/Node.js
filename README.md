# 常见的 node.js 核心模块

- **assert**: 提供断言测试功能。
- **async_hooks**: 跟踪异步资源的生命周期。
- **buffer**: 处理二进制数据流。
- **child_process**: 衍生子进程。
- **cluster**: 创建共享端口的多进程服务器。
- **console**: 提供控制台调试工具。
- **crypto**: 提供加密和解密功能。
- **dgram**: 提供 UDP 数据报套接字。
- **dns**: 提供域名解析功能。
- **events**: 提供事件发布和订阅机制。
- **fs**: 提供文件系统操作功能。
- **http**: 创建 HTTP 服务器和客户端。
- **http2**: 创建 HTTP/2 服务器和客户端。
- **https**: 创建 HTTPS 服务器和客户端。
- **inspector**: 提供调试工具。
- **module**: 提供模块加载和管理功能。
- **net**: 提供 TCP 套接字。
- **os**: 提供操作系统信息。
- **path**: 提供路径操作功能。
- **perf_hooks**: 提供性能分析工具。
- **process**: 提供当前 Node.js 进程的信息和控制。
- **punycode**: 提供 Punycode 编码和解码功能。
- **querystring**: 提供查询字符串解析和格式化功能。
- **readline**: 提供逐行读取流的功能。
- **repl**: 提供交互式解释器环境。
- **stream**: 提供流操作功能。
- **string_decoder**: 提供字符串解码功能。
- **timers**: 提供定时器功能。
- **tls**: 提供 TLS/SSL 加密功能。
- **trace_events**: 提供跟踪事件功能。
- **tty**: 提供终端操作功能。
- **url**: 提供 URL 解析和格式化功能。
- **util**: 提供实用工具函数。
- **v8**: 提供 V8 引擎信息。
- **vm**: 提供虚拟机环境。
- **wasi**: 提供 WebAssembly 系统接口。
- **worker_threads**: 提供多线程功能。
- **zlib**: 提供压缩和解压缩功能.





# fs



## 使用 node.js 读取文件

```javascript
const fs = require("fs");

fs.readFile("/users/joe/test.txt", "utf-8", (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    
    console.log(data);
});
```





**`另外，你可以使用同步版本 fs.readFileSync()：`**

```javascript
const fs = require("fs");

try {
    const data = fs.readFileSync("/users/joe/test.txt", "utf-8");
	console.log(data);
} catch (err) {
    console.error(err);
}
```





## 使用 node.js 编写文件

### 编写文件

```javascript
const fs = require('node:fs');

const content = 'Some content!';

fs.writeFile('/Users/joe/test.txt', content, err => {
  if (err) {
    console.error(err);
  } else {
    // file written successfully
  }
});

```



### 同步编写文件

```javascript
const fs = require('node:fs');

const content = 'Some content!';

try {
  fs.writeFileSync('/Users/joe/test.txt', content);
  // file written successfully
} catch (err) {
  console.error(err);
}
```





## 使用 node.js 中的文件夹



### 创建一个新文件夹

```javascript
const fs = require("fs");

const folderName = "/users/joe/test";

try {
    if(!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
    }
} catch(err) {
    console.error(err);
}
```





# http

**`创建一个简单的 HTTP 服务器`**

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, Node.js!\n');
});

const port = 3000;
server.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}/`);
});
```





**`发送 http 请求`**

```javascript
const http = require('http');

const options = {
  hostname: 'www.example.com',
  port: 80,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);

  res.on('data', (chunk) => {
    console.log(`响应内容: ${chunk}`);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
```





# path



**`规范化路径`**

```javascript
const path = require('path');

const filePath = '/foo/bar//baz/asdf/quux/..';
const normalizedPath = path.normalize(filePath);
console.log(normalizedPath); // 输出: /foo/bar/baz/asdf
```



**`连接路径`**

```javascript
const path = require('path');

const joinedPath = path.join('/foo', 'bar', 'baz/asdf', 'quux', '..');
console.log(joinedPath); // 输出: /foo/bar/baz/asdf
```





# os

**`获取操作系统类型`**

```javascript
const os = require('os');

console.log(os.type()); //  例如: Darwin, Windows_NT, Linux
```





**`获取 CPU 信息`**

```javascript
const os = require('os');

console.log(os.cpus()); //  返回 CPU 信息的数组
```







# events

**`创建和使用自定义事件`**

```javascript
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();
myEmitter.on('event', () => {
  console.log('事件被触发！');
});
myEmitter.emit('event');
```







# url

**`解析 URL`**

```javascript
const url = require('url');

const myURL = new URL('https://example.org/foo?bar=1&baz=2');
console.log(myURL.searchParams.get('bar')); // 输出: 1
console.log(myURL.pathname); // 输出: /foo
```







# util

**`格式化字符串`**

```javascript
const util = require('util');

const formattedString = util.format('Hello, %s! You are %d years old.', 'World', 30);
console.log(formattedString); // 输出: Hello, World! You are 30 years old.
```







