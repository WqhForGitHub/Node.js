

# 16.2 Node 默认异步

 ```javascript
 const fs = require("fs");
 
 function readConfigFile(path, callback) {
     fs.readFile(path, "utf-8", (err, text) => {
         if (err) {
             console.error(err);
             callback(null);
             return;
         }
         
         let data = null;
         try {
             data = JSON.parse(text);
         } catch(e) {
             console.error(e);
         }
         
         callback(data);
     })
 }
 ```



```javascript
const util = require("util");
const fs = require("fs");
const pfs = {
    readFile: util.promisify(fs.readFile);
};

function readConfigFile(path) {
    return pfs.readFile(path, "utf-8").then(text => {
        return JSON.parse(text);
    });
}
```



​             



# 16.4 事件与 EventEmitter

 ```javascript
 const net = require("net");
 let server = new net.Server();
 server.on("connection", socket => {
     socket.end("Hello World", "utf-8");
 })
 ```







# 16.5 流

```javascript
const fs = require("fs");

function copyFile(sourceFilename, destinationFilename, callback) {
    fs.readFile(sourceFilename, (err, buffer) => {
        if (err) {
            callback(err);
        } else {                                  
            fs.writeFile(destinationFilename, buffer, callback);
        } 
    })
}
```





# 16.6 进程、CPU 和 操作系统细节

```javascript
process.argv; // 包含命令行参数的数组
process.arch; // CPU 架构：如 x64
process.cwd(); // 返回当前工作目录
process.chdir(); // 设置当前工作目录
process.cpuUsage(); // 报告 CPU 使用情况
process.env; // 环境变量对象
process.execPath; // Node 可执行文件的绝对路径
process.exit(); // 终止当前程序
process.exitCode; // 程序退出时报告的整数编码
process.getuid(); // 返回当前用户的 unix 用户 ID
process.hrtime.bigint(); // 返回高分辨率纳秒级时间戳
process.kill(); // 向另一个进程发送信号
process.memoryUsage(); // 返回一个包含内存占用细节的对象
process.nextTick(); // 类似于 setImmediate()，立刻调用一个函数
process.pid; // 当前进程的进程 ID
process.ppid; // 父进程 ID
process.platform; // 操作系统：如 Linux、Darwin 或 Win32
process.resourceUsage(); // 返回包含资源占用细节的对象
process.setuid(); // 通过 ID 或名字设置当前用户
process.title; // 出现在 ps 列表中的进程名
process.umask(); // 设置或返回新文件的默认权限
process.uptime(); // 返回 Node 正常运行的时间（秒）
process.version; // Node 的版本字符串
process.versions; // Node 依赖库的版本字符串
```



**`os 模块`**

```javascript
const os = require("os");

os.arch(); // 返回 CPU 架构：如 x64 或 arm
os.constants; // 有用的常量：如 os.constants.signals.SIGINT
os.cpus(); // 关于系统 CPU 核心的数据，包括使用时间
os.endianness(); // CPU 的原生字节序：BE 或 LE
os.EOL; // 操作系统原生的行终止符：\n 或 \r\n
os.freemem(); // 返回自由 RAM 数量（字节）
os.getPriority(); // 返回操作系统调度进程的优先级
os.homedir(); // 返回当前用户的主目录
os.hostname(); // 返回计算机的主机名
os.loadavg(); // 返回 1、5 和 15 分钟的平均负载
os.networkInterfaces(); // 返回可用网络连接的细节
os.platform(); // 返回操作系统：例如 Linux、Darwin 或 Win32
os.release(); // 返回操作系统的版本号
os.setPriority(); // 尝试设置进程的调度优先级
os.tmpdir(); // 返回默认的临时目录
os.totalmem(); // 返回 RAM 的总数（字节）
os.type; // 返回操作系统：Linux、Darwin 或 Windows_NT 等
os.uptime(); // 返回系统正常运行的时间（秒）
os.userInfo(); // 返回当前用户的 uid、username、home 和 shell 程序
```





# 16.7 操作文件



## 1. 路径、文件描述符和 FileHandle

```javascript
const path = require("path");

let p = "src/pkg/test.js";

path.basename(p); // "test.js"
path.extname(p); // ".js"
path.dirname(p); // "src/pkg"
path.basename(path.dirname(p)); // "pkg"
path.dirname(path.dirname(p)); // "src"

// normalize() 清理路径
path.normalize("a/b/c/../d/"); // "a/b/d"：处理 ../ 部分
path.normalize("a/./b"); // "a/b"：去掉 ./ 部分
path.normalize("//a//b//"); // "/a/b/"：去除重复的 /

// join() 组合路径片段、添加分隔符，然后规范化
path.join("src", "pkg", "t.js"); // "src/pkg/t.js"

path.resolve(); // process.cwd()
path.resolve("t.js"); // path.join(process.cwd(), "t.js")
path.resolve("/tmp", "t.js"); "/tmp/t.js"
path.resolve("/a", "/b", "t.js"); // "/b/t.js"
```



## 2. 读文件

 ```javascript
 const fs = require("fs");
 let buffer = fs.readFileSync("test.data"); // 同步，返回缓冲区
 let text = fs.readFileSync("data.csv", "utf-8"); // 同步，返回字符串
 
 // 异步读取文件的字节
 fs.readFile("test.data", (err, buffer) => {
     if(err) {
         
     } else {
         
     }
 });
 ```



## 3. 写文件

```javascript
const fs = require("fs");

let output = fs.createWriteStream("numbers.txt");

for(let i = 0; i < 100; i++) {
    output.write(`${i}\n`);
}

output.end();
```



## 5. 文件元数据

```javascript
const fs = require("fs");

let stats = fs.statSync("book/ch15.md");

stats.isFile(); // true，这是一个普通文件
stats.isDirectory(); // false：它不是一个目录
stats.size; // 文件大小（字节）
stats.atime; // 访问时间：最后读取的日期
stats.mtime; // 修改时间：最后写入的日期
stats.uid; // 文件所有者的用户 ID
stats.gid; // 文件所有者的组 ID
stats.mode.toString(8); // 八进制字符串形式的文件权限
```



​                                                                                                                                                            
