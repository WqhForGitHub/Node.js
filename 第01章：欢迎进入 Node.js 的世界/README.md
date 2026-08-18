# 1.1 一个典型的 Node Web 应用程序

大体来说，Node 和 JavaScript 的优势之一是它们的单线程编程模型。多个线程一般会引入 bug，尽管一些新的编程语言，包括 Go 和 Rust，试图提供更加安全的并发工具，但 Node 仍然保留了 JavaScript 在浏览器中所用的模型，在为浏览器写代码时，我们写的指令序列一次执行一条，代码不是并行执行的。然而对于用户界面来说，这样是不合理的：没有哪个用户想在浏览器执行网络访问或文件获取这样的低速操作时干等着。为了解决这个问题，浏览器引入了事件机制：在你点击按钮时，就有一个事件被触发，还有一个之前定义的函数会跑起来。这种机制可以规避一些在线编程中经常出现的问题，比如资源死锁和竞态条件、
## 1.1.1 非阻塞 I/O

那么在服务器端编程中，这有什么意义呢？其实服务器端编程面对的情况也差不多：访问磁盘和网络这样的 I/O 请求会比较慢，所以我们希望，在读取文件或通过网络发送消息时，运行平台不会阻塞业务逻辑的执行。Node 用三种计数来解决这个问题：事件、异步 API、非阻塞 I/O。在 Node 程序员看来，非阻塞I/O是个底层术语。它的意思是说，你的程序可以在做其他事情时发起一个请求来获取网络资源，然后当网络操作完成时，将会运行一个回调函数来处理这个操作的结果。
图 1-1 展示了一个典型的 Node Web 应用程序，它用 Web 应用库 Express 来处理商店的订单流。为了购买产品，浏览器发起了一个请求，然后应用程序检查库存，为该用户创建一个账号，发回执邮件，并返回一个 JSON HTTP 响应给浏览器。同时在做的其他事情有：发送了一封回执邮件，更新了数据库来保存用户的详细信息和订单。代码本身很简单，就是 JavaScript 指令，但运行平台是并发操作的，因为它用了非阻塞 I/O。
![非阻塞I/O](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%B8%80%E7%AB%A0%EF%BC%9A%E6%AC%A2%E8%BF%8E%E8%BF%9B%E5%85%A5%20Node.js%20%E7%9A%84%E4%B8%96%E7%95%8C/%E4%B8%80%E4%B8%AANode%E5%BA%94%E7%94%A8%E7%A8%8B%E5%BA%8F%E4%B8%AD%E7%9A%84%E5%BC%82%E6%AD%A5%E9%9D%9E%E9%98%BB%E5%A1%9E%E7%BB%84%E4%BB%B6.png)
图 1-1 一个 Node 应用程序中国的异步非阻塞组件

在图 1-1 中，数据库是通过网络访问的。Node 中的网络访问是非阻塞的，它用了一个名为 libuv 的库来访问操作系统的非阻塞网络调用。这个库在 Linux、macOS 和 Windows 中的实现是不同的，但不用担心，因为你只需要会用操作数据库的 JavaScript 库就可以了。只要写一些 db.inert(query, err => ()) 这样的代码，Node 就会帮你完成那些经过高度优化的非阻塞网络操作。
访问硬盘也差不多，但又不完全一样。在生成了回执邮件并从硬盘中读取邮件模板时，libuv 借助线程池模拟出了一种使用非阻塞调用的假象。管理线程池是一个苦差事，相较而言，email.send('template.ejs', (err, html) => { }) 这样的代码可能要容易理解得多了。
在进行速度较慢的处理时让 Node 能做其他事情，是使用带非阻塞 I/O 的异步 API 真正的好处。即便你只有一个单线程、单进程的 Node Web 应用，它也可以同时处理上千个网站访客发起的连接。要想知道 Node 是如何做到的，得先研究一下事件轮询。
## 1.1.2 事件轮询

我们把图 1-1 放大，仔细研究响应浏览器的请求那部分。在这个应用程序当中，Node 内置的 HTTP 服务器库，即核心模块 http.Server，负责用流、事件、Node 的 HTTP 请求解析器的组合来处理请求，它会本地代码。你用 Express Web 应用库添加的回调函数，也是由它触发的。这个回调函数又会触发数据库查询语句，最终应用程序会用 HTTP 发送 JSON 作为响应。整个过程用了三个非阻塞网络调用：一个用于请求，一个用于数据库，还有一个用于响应。Node 是如何调配这些网络操作的呢？答案是事件轮询（event loop）。图 1-2 展示了如何用事件轮询完成这三个网络操作。
![事件轮询](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%B8%80%E7%AB%A0%EF%BC%9A%E6%AC%A2%E8%BF%8E%E8%BF%9B%E5%85%A5%20Node.js%20%E7%9A%84%E4%B8%96%E7%95%8C/%E4%BA%8B%E4%BB%B6%E8%BD%AE%E8%AF%A2.png)
图 1-2 事件轮询
事件轮询是单向运行的先入先出队列，它要经过几个阶段，轮询中每个迭代都要运行的重要阶段已经在图 1-2 中展示出来了。首先是计时器开始执行，这些计时器都是用 JavaScript 函数 setTimeout 和 setInterval 安排好的。接下来是运行 I/O 回调，即触发你的回调函数。轮询阶段会去获取新的 I/O 事件，最后是用 setImmediate 安排回调。这是一个特例，因为它允许你将回调安排在当前队列中的 I/O回调完成之后立即执行。现在你可能还会觉得有点儿抽象，不过只需要记住，尽管 Node 是单线成的，但你仍然用它提供的工具写出可伸缩的高效代码。
你可能注意到了，前面几页中的代码用到了 ES2015 的箭头函数。Node 支持很多 JavaScript 的新特性，所以我们想先带你看一看能用哪些新特来写出更棒的代码，然后再继续介绍 Node。
# 1.2 ES2015、Node 和 V8

如果你以前曾因 JavaScript 没有类而伤心难过，或者被它奇怪的作用域规则搞得头昏脑胀，那你肯定会喜欢我们接下来要讲的内容。Node 解决了很多问题，现在你可以创建类了。const 和 let（代替了 var）解决了作用域的问题。从 Node 6 开始，你可以用默认函数参数、剩余参数、spread 操作符、for...of 循环、模板字符串、解构、生成器等很多新特性。http://node.green 上汇总了 Node 支持的 S2015 特性，建议你看一下。
先说类。在 ES5 及之前的版本中，我们要用 prototype 对象来创建类似于类的结构：
```javascript
function User() {
	// 构造器
}

User.prototype.method = function() {
	// 方法
};
```
有了 Node 6 和 ES2015，你可以用类将上面的代码写成：
```javascript
class User {
	constructor() {}
	method() {}
}
```
代码少了，也跟容易理解了。但还不止于此，Node 也支持子类、超类和静态方法。对于熟悉其他语言的人来说，采用了类语法的 Node 比 ES5 更好用。
const 和 let 是从 Node 4 开始支持的。在 ES5 中，所有变量都是用 var 创建的。不管是在函数中还是全局作用域中，都是用 var 定义变量，所以我们没办法在 if 语句、for 循环以及其他块中定义块级别的变量。
>我应该用 const 还是 let
>
>在决定是用 const 还是用 let 时，几乎都可以用 const。因为你的大部分代码都是在用你自己的类实例、对象常量或不会变的值，所以大部分情况下都可以用 const。即便是有可修改属性的对象，也是可以用 const 声明的，因为 const 的意思是引用是只读的，而不是指是不可变的。

Node 还有原生的 promise 和生成器。为了让我们能用流畅的接口风格编写异步代码，有很多库都支持 promise。对于流畅的接口风格，你可能并不陌生，如果你通过 jQuery 之类的 API，甚至只要用过 JavaScript 数组，就已经见过它是什么样的了。下面就是一个将调用链起来处理数组的小例子：
```javascript
[1,2,3]
	.map(n => n * 2)
	.filter(n => n > 3);
```
**生成器**能把异步 I/O 变成同步编程风格。Koa Web 应用库中用到了生成器，你可以研究下它的代码以了解生成器的用法，如果结合 Koa 使用 promise 和其他生成器，你就可以抛开层层嵌套的回调，在值上 yield。
ES2015 中的**模板字符串**在 Node 中也很好用。在 ES5 中，字符串常量不支持插值，也不能跨行。现在我们可以用反引号（`）定义模板字符串，不仅可以插值，而且还可以跨行。比如像下面这个例子一样，在 Web 应用中直接定义一小段 HTML 模板：
```javascript
this.body = `
	<div>
		<h1>Hello from Node</h1>
		<p>Welcome, ${user.name}</p>
	</div>
`;
```
在 ES5 中，前面那个例子只能写成这样：
```javascript
this.body =`\n`;
this.body += '<div>\n';
this.body += '  <h1>Hello from Node </h1>\n';
this.body += '  <p>Welcome, ' + user.name + '</p>\n';
this.body += '</div>\n'
```
老套路不仅代码多，而且还容易出错。对 Node 程序员来说，最后一个非常重要的特性是箭头函数。**箭头函数**的语法非常精炼。比如说，如果你要写有一个参数和一个返回值的回调函数，那么像下面这么简单就可以：
```javascript
[1, 2, 3].map(v => v * 2);
```
在 Node 中，我们一般会需要两个参数，因为回调的第一个参数通常是错误对象。这时候需要用括号把参数括起来：
```javascript
const fs = require('fs');
fs.readFile('package.json', 
	(err, text) => console.log('Length:', text.length)
);
```
如果函数体的代码不止一行，则需要用到大括号。箭头函数的价值不仅体现在其精炼的语法上，还跟 JavaScript 作用域有关。在 ES5 及之前版本的语言中，在函数中定义函数会把 this 引用变成全局对象。就因为这个问题，下面这种按 ES5 写的类很容易出错：
```javascript
function User(id) {
	// 构造器
	this.id = id;
}

User.prototype.load = function() {
	var self = this;
	var query = `SELECT * FROM users WHERE id = ?`;
	sql.query(query, this.id, function(err, users) {
		self.name = users[0].name;
	});
};
```
该 self.name 赋值那行代码不能写成 this.name，因为这个函数的 this 是个全局变量。常用的解决方法是在函数的入口处将 this 赋值给一个变量。但箭头函数的绑定没有这个问题。所以在 ES2015 中，上面这个例子可以改写成更加直观的形式：
```javascript
class User {
	constructor(id) {
		this.id = id;
	}
	
	load() {
		const query = 'SELECT * FROM users WHERE id = ?';
		sql.query(query, this.id, (err, users) => {
			tihs.name = users[0].name;
		});
	}
}
```
你不仅可以用 const 更好地建模数据库查询，而且还去掉了麻烦的 self 变量。让 Node 代码变得更容易理解的 ES2015 的特性还有很多，篇幅受限就不一一介绍了。但我们接下来要看看这都是谁的功劳，以及它与之前讲的非阻塞 I/O 有什么关系。
## 1.2.1 Node 与 V8

Node 的动力源自 V8 JavaScript 引擎，是由服务于 Google Chrome 的 Chromium 项目组开发的。V8 的一个值得称道的特性是它会将 JavaScript 直接编译为机器码，另外它还有一些代码优化特性，所以 Node 才能这么快。在 1.1.1 节，我们曾提到过 Node 的另一个本地部件 libuv，它是负责处理 I/O 的。V8 负责 JavaScript 代码的解释和执行。用 C++ 绑定层可将 libuv 和 V8 结合起来。图1-3 给出了组成 Node 的所有软件组件。
![Node.js的软件栈](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%B8%80%E7%AB%A0%EF%BC%9A%E6%AC%A2%E8%BF%8E%E8%BF%9B%E5%85%A5%20Node.js%20%E7%9A%84%E4%B8%96%E7%95%8C/Node.js%E7%9A%84%E8%BD%AF%E4%BB%B6%E6%A0%88.png)
图1-3 Node.js 的软件栈
因此，Node 中能用的 JavaScript 特性都可以追溯到 V8 对该特性的支持。这一支持是通过特性组来管理的。
## 1.2.2 使用特性组

Node 包含了 V8 提供的 ES2015 特性。这些特性分为 **shipping**、**staged**、**progress** 三组。shipping 组的特性是默认开启的，staged 和 in progress 组的特性则需要用命令行参数开启。如果你想用 staged 特性，可以在运行 Node 时加上参数 --harmony，V8 团队将所有接近完成的特性都放在了这一组。然而，in progress 特性稳定性较差，需要具体的特性参数来开启。Node 的文档建议通过 grep "in progress" 来查询当前可用的 in progress 特性：
```shell
node --v8-options | grep "in progress"
```
在不同的 Node 版本中执行这条命令后得到的结果也是不同的。Node 自己也有个版本计划，定义了它要提供哪些 API。
## 1.2.3 了解 Node 的发布计划

Node 的发行版分为长期支持版（LTS）、当前版本和每日构建版三组。LTS 版有 18 个月的支持的服务，期满后还有 12 个月的维护性支持服务。版本号是按照语义版本（SemVer）编制的。SemVer 给每个版本定义了一个主要、次要和补丁版本号。比如 6.9.1 的主要版本号是 6， 次要版本号是 9，补丁版本号是 1。主要看到主版本号发生变化，那就意味着有些 API 可以不兼容了，也就是说如果要用这个版本的 Node，那么你的项目需要重新测试一下。另外，按 Node 的发布规则，主版本号增长意味着新的当前版也已经且下来了。每日构建版的构建是自动进行的，每隔 24 小时一次，包含这 24 小内的最新修改，但一般只用来测试 Node 的最新特性。
用哪个版本取决于你的项目和组织。有些人可能喜欢更不那么频繁的 LTS，对于那些难以管理频繁更新的大公司来说，这个版本可能更好。但如果你想跟上性能和功能的改进，当前版更合适.
# 1.3 安装 Node

安装 Node 的最简单的方法是使用其官网上的安装程序。可以用对应 Mac 或 Windows 的安装程序安装最新的当前版（写作本书时是 6.5）。或者用操作系统上的包管理器，Debian、Ubuntu、Arch、Fedora、FreeBSD、Gentoo 和 SUSE 全都有安装包，另外还有 Homebrew 和 SmartOS 的安装包。如果没有能用在你的操作系统上的包，也可以下载源码自己构建。
>提示
>
>附录 A 提供了更加详细的 Node 安装指南。

Node 官网（[[https://nodejs.org/zh-cn/download/]]）上有个包含所有安装包的列表，源码GitHub（[[https://github.com/nodejs/node/]]）上。建议收藏一下 Node 在 GitHub 上的项目主页以备不时之需，比如有时候你可能想看看它的源码。
装好之后，可以在终端中输入 node -v 来试一下。这个命令应该会输出你所安装的 Node 的版本号。接下来，创建一个名为 hello.js 的文件，内容如下所示：
```javascript
console.log("hello from Node");
```
保存文件，输入 node hello.js 运行它。恭喜你，都准备好了，你可以开始用 Node 写程序了。
>在 Windows、Linux 和 macOS 上快速上手
>sdf
>如果你刚开始接触编程，还没找到自己喜欢的文本编辑器，那么 Visual Studio Code 是一个不错的选择。这是微软开发的，但开源，可以免费下载，支持 Windows、LInux 和 macOS。。
>Visual Studio Code 为新手提供了一些友好的辅助功能，包括 JavScript 语法高亮、Node 核心模块自动补足等。所以你的 JavaScript 代码看起来会更清晰，并且你在输入时还能看到一个所支持方法和对象的列表。它还有一个命令行界面，可以输入 Node 来调用 Node。有了这个命令行界面，需要运行 Node 和 npm 命令时间会很方便。Windows 用户可能会觉得这个比 cmd.exe 好用。我们的代码都在 Windows 上用 Visual Studio Code 测试过，所以应该不需要任何特殊的东西来运行本书中的例子。
>可以从参照 Visual Studio Code Node.js 教程开始。

# 1.4 Node 自带的工具

Node 自带了一个包管理器，以及从文件和网络 I/O 和 zlib 压缩等无所不包的核心 JavaScript 模块，还有一个调试器。npm 包管理器是这个基础设施中的重要组成部分，也是我们要重点介绍的。
如果你想检查一下 Node 是否已经安装成功，可以在命令行里运行 node -v 和 npm -v，这两个命令分别用来显示你所安装的 Node 和 npm 的版本。
## 1.4.1 npm

命令行工具 npm 是用 npm 调用的。你可以用它来安装 npm 注册中心里的包，也可以用它来查找和分享你自己的项目，开源的和闭源的都行。注册中心里的每个 npm 包都会有个页面显示它的自述文件、作者和下载统计信息。
另外，npm 还是一家提供 npm 服务的公司的名字。这家公司为企业提供商业服务，包括托管私有的 npm 包。你可以按月支付服务费，把公司的源码托管给他们，这样你的 JavaScript 开发人员就可以用 npm 轻松安装你的私有包了。
在用 npm 安装这些包时，你要决定似乎装在你的项目中还是装在全局。要全局安装的包一般是工具，即你要咋命令行里运行的程序，比如 gulp-cli 包。
npm 要求 Node 项目所在的目录下有一个 package.json 文件。创建 package.json 文件的最简单方法是使用 npm。在命令行中输入下面这些命令：
```shell
mkdir example-project
cd example-project
npm init -y
```
打开 package.json，你会看到简单的 JSON 格式的项目描述信息。如果你现在用带有参数 --save 的 npm 命令从 npm 网站上安装一个包，它会自动更新你的 package.json 文件。试着输入 npm install，或简写为 npm i：
```bash
npm i --save express
```
打开 package.json，应该会看到 dependencies 属性下面i新增加的 express。另外，看一下 node_modules 文件夹，你会看到新创建的 express 目录。里面是刚安装的那个版本的 Express。你也可以用 --global 参数做全局安装。应尽可能地将包安装在项目里，但对于用在 Node JavaScript 代码之外的命令行工具，全局安装更合适。比如用 npm 安装命令红工具 ESLint 时，我们采用全局安装。
开始用 Node 之后，你会经常用到来自 npm 的包。另外，Node 还自带了很多非常实用的库，统称为**核心模块**，接下来我们就去看一下。
## 1.4.2 核心模块

Node 的核心模块就相当于其他语言的标准库，它们是编写服务器端 JavaScript 所需的工具。大多数服务器端开发人员都知道，JavaScript 标准本身没有任何处理网络的东西，甚至连处理文件 I/O 的东西都没有。Node 最少的代码给它加上了文件和 TCP/IP 网络功能，使其成为了一个可用的服务器端编程语言。
### 1.4.2.1 文件系统

Node 不仅有文件系统库（fs、path）、TCP 客户端和服务端库（net）、HTTP 库（http 和 https）和域名解析库（dns），还有一个经常用来写测试的断言库（assert），以及一个用来查询平台信息的操作系统库（os）。
Node 还有一些独有库。事件模块是一个处理事件的小型库，Node 的大多数 API 都是以它为基础来做的。比如说，流模块用事件模块提供了一个处理流数据的抽象接口。因为 Node 中的所有数据流用的都是同样的 API，所以你可以很轻松地组装出软件组件。如果你有一个文件流读取器，就可以很方便地把它跟压缩数据的 zlib 连接到一起，然后这个 zlib 再连接一个文件流写入器，从而形成一个文件流处理管道。
在下面这段代码中，我们用 Node 的 fs 模块创建了读和写流，然后把它们通过另外一个流（gzip）连接起来传输数据，就这个例子而言，就是压缩。
#### 代码清单 1-1：使用核心模块和流
```javascript
const fs = require('fs');
const zlib = require('zlib');
const gzip = zlib.createGzip();
const outStream = fs.createWriteStream('output.js.gz');

fs.createReadStream('./node-stream.js')
	.pipe(gzip)
	.pipe(outStream);
```
### 1.4.2.2 网络

曾几何时，我们总是是创建一个简单的 HTTP 服务器才是 Node 真正的 Hello World。在 Node 中搭一个服务器只需要加载 http 模块，然后给它一个函数。这个函数有两个参数，即请求和响应。你可以在自己的终端中运行一下这段代码。
#### 代码清单1-2 用 Node 的 http 模块写的 Hello World
```javascript
const http = require('http');
const port = 8080;

const server = http.createServer((req, res) => {
	res.end('Hello, world');
});

server.listen(port, () => {
	console.log('Server listening on: http://localhost:%s', port);
});
```
## 1.4.3 调试器

Node 自带的调试器支持单步执行和 REPL（读取-计算=输出-循环）。这个调试器在工作时会用一个网络协议跟你的程序对话。带着 debug 参数运行程序，就可以对这个程序开启调试器。比如要调试代码清单 1-2 中的代码：
```shell
node debug hello.jks
```
>交互式调试
>Node 支持 Chrome 调试协议。如果要用 Chrome 的开发者工具调试一段脚本，可以在运行程序时加上 --inspect 参数：
>node --inspect
>这样 Node 就会启动调试器，并停在第一行。它会输出一个 URL 到控制台，你可以在 Chrome 中打开这个 URL，然后用 Chrome 的调试器进行调试。Chrome 的调试器可以一行行地执行代码，还能显示每个变量和对象的值。这要比在代码里敲 console.log 好得多。

# 1.5 三种主流的 Node 程序

Node 程序主要可以分成三种类型：Web 应用程序、命令行工具和后台程序、桌面程序。提供单页应用的简单程、REST 微服务以及全栈的 Web 应用程序。你可能已经使用过用 Node 写的命令行工具了，比如 npm、Gulp 和 Webpack。后台程序就是后台服务，比如 PM2 进程管理器。桌面程序一般是用 Electron 框架写的软件，Electron 用 Node 作为基于 Web 的桌面应用的后台，Atom 和 Visual Studio Code 文本编辑器都属于这一类。
## 1.5.1 Web 应用程序

因为 Node 是服务器端 JavaScript 平台，所以用它搭建 Web 应用程序是理所当然的事情，既然客户端和服务器端用的都是 JavaScript，代码难免会有在这两种环境重用的机会。Node Web 英语给你一般是用 Express 这样的框架写的。第 5 章介绍了几个主要的 Node 服务器端框架，第 6 章专门介绍了 Connect 和 Express，第 7 章是 Web 应用程序模板。
你可以通过创建一个新目录，然后在里面安装 Express 模板，来快速创建一个 Express Web 阴公程序：
```shell
mkdir hello_express
cd hello_express
npm init -y
npm i express --save
```
接下来把下面的 JavaScript 代码存到 server.js 中。
### 代码订单 1-3 一个 Node Web 应用程序
```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
	res.send('Hello World!');
});
app.listen(3000, () => {
	console.log('Express web app on localhost:3000')
});
```
现在输入 npm start，启动这个监听端口 3000 的 Node Web 服务器。这浏览器中打开 [[http://localhost:3000]]，就能看到 res.send 那行代码发回的文本。
在前端开发中的世界里，Node 也在发挥着重要作用，因为它是进行语言转译的主要工具，比如从 TypeScript 到 JavaScript。转译器将一种高级语言编译成另外一种高级语言，传统的编译器则将一种高级语言编译成一种低级语言。第 4 章将会专门介绍前端构建系统，到时候你会看到 npm 脚本、Gulp 和 Webpack 的用法。
并不是所有的 Web 开发都会涉及 Web 应用的构建。有时候，在重建一个网站时，你需要把数据从老网站上扒出来、我们专门加了个附录 B 来讲网页抓取，以便展示如何用 Node 的 JavaScript 运行平台处理文档对象模型（DOM），同时也展示了如何在 Express Web 应用这个舒适区之外使用 Node。如果你只是想快速地构建一个简单的 Web 应用，第 3 章为我们提供了一个完整的 Node Web 应用程序搭建教程。
## 1.5.2 命令行工具和后台程序

Node 可以用来编写命令行工具，比如 JavaScript 开发人员所用的进程管理器和 JavaScript 转译器。它也可以作为一种方便的方式来编写其他操作的命令行工具，比如图片转换、控制媒体文件播放的脚本等。
你可以试一下下面这个例子。创建一个名为 cli.js 的新文件，添加如下代码：
```javascript
const { nodePath, scriptPath, name } = process.argv;
console.log('Hello', name);
```
用 node cli.js yourName 运行这个脚本，你会看到 Hello yourName。这用到了 ES2015 的解构，它会从 process.argv 中拉取第三个参数。所有 Node 程序都可以访问 process 对象，这是用户向程序中传递参数的基础。
Node 命令行程序还可以做其他事情。如果在程序开头的地方加上 #!，并赋予其执行许可（chmod +x cli.js），shell 就可以在调用程序时使用 Node。也就是说可以像运行其他 shell 脚本那样运行 Node 程序。在类 Unix 系统中用下面这样的代码：
```shell
#!usr/bin/env node
```
这样你就可以用 Node 替代 shell 脚本。也就是说 Node 可以跟其他任何命令行工具配合，包括后台程序。Node 程序可以由 cron 调用，也可以作为后台程序运行。
如果你觉得这一切都很陌生，不用担心。第 11 章将会介绍如何编写命令行工具，展示 Node 在这种程序上的实力。比如说，大量使用流作为通用 API 的命令行工具，而流处理是 Node 最强大的功能之一。
## 1.5.3 桌面程序

如果你用过 Atom 或 Visual Studio Code 文本编辑器，那就用过 Node。Electron 框架用 Node 做后台，所以只要需要访问硬盘或网络，Electron 就会用到 Node，Electron 还用 Node 来管理依赖项，也就是说你可以用 npm 往 Electron 项目里添加包。
如果你现在就想试一下，可以复制 Electron 的存储库并启动给你一个应用程序：
```shell
git clone https://github.com/electron/electron-quick-start
cd electron-quick-start
npm install && npm start
curl localhost:8081
```
如果你想要了解如何用 Electron 写程序们，可以翻到第 12 章看一下。
## 1.5.4 适合 Node 的应用程序

我们已经看过一些能用 Node 搭建的应用程序了，但 Node 擅长的领域不止于此。Node 一般用来创建实时的 Web 应用，这几乎无所不包，从直接面对用户的聊天服务器到采集分析数据的后台程序都属于此类。在 JavaScript 中，函数是一等对象，Node 又有内建的事件模型，所以用它来写异步实时程序比用其他脚本语言更自然。
如果你要搭建传统的模型-视图-控制器（MVC）Web 应用，用 Node 也很适合。Ghost 等一些流行的博客引擎就是用 Node 搭建的。在搭建这几种类型的 Web 应用程序方面，Node 是一个经过实践校验的平台。虽然开发风格跟用 PHP 的 WordPress 不同，但 Ghost 支持的功能是类似的，包括模板和多用户管理区，
Node 还能做一些用其他语言很难做到的事情。它是基于 JavaScript 的，所以在 Node 中能浏览器中的 JavaScript。复杂的客户端应用可以经过改造在 Node 服务器上运行，让服务器进行预渲染，从而加快页面在浏览器中国的渲染速度，也有利于搜素引擎进行索引。
最后，如果你想要搭建一个桌面端或移动端应用，建议试一下 Electron，它也是由 Node 支撑起来的。现在 Web 用户界面的体验跟桌面端应用一样丰富，所以你可以在 Windows、Linux 和 macOS 上 重用这些代码。





























































