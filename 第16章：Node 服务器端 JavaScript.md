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







