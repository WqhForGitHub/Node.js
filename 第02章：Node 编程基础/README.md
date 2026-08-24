# 2.1 Node 功能的组织及重用

在创建程序时，不管是用 Node 还是其他工具，基本不可能把所有代码都放到一个文件中。当出现这种情况时，传统的方式是按逻辑相关性对代码分组，将包含大量代码的单个文件分解成多个文件，如图 2-1 所示。
![容易查找](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E5%AE%B9%E6%98%93%E6%9F%A5%E6%89%BE.png)
图 2-1 与全部存放在一个长文件中的代码相比，用目录和单独的文件组织起来的代码更容易查找
Node 模块允许从被引入文件中选择要暴露给程序的函数和变量。如果模块返回的函数或变量不止一个，那它可以通过设定 exports 对象的属性来指明它们。但如果模块只返回一个函数或变量，则可以设定 module.exports 属性。图 2-2 展示了这一工作机制。
# 2.2 开始一个新的 Node 项目

创建新的 Node 项目很简单：创建一个文件夹，运行 npm init。好了，npm 命令会问几个问题，一直回答 yes 就可以了：
下面是一个完整的例子：
```shell
mkdir my_module
cd my_module
npm init -y
```
参数 -y 表示 yes。这样 npm 就会创建一个全部默认值的 package.json 文件。如果你想要更多的控制权，去掉参数 -y，你就能看到 npm 提出的一系列问题，包括授权许可、作者姓名，等等。完成之后看一下 package.json，你会在其中发现自己提供的那些答案。你也可以手动编辑，但记得必须是有效的 JSON。
空项目有了，可以创建模块了。
## 创建模块

模块既可以是一个文件，也可以是包含一个或多个文件的目录，如图 2-3 所示。如果模块是一个目录，Node 通会在这个目录下找一个叫 index.js 的文件作为模块的入口（这个默认设置可以重写，见 2.5 节）。
### 代码清单 2-1 定义一个 Node 模块（currency.js）
```javascript
const canadianDollar = 0.91;

function roundTwo(amount) {
	return Math.round(amount * 100) / 100;
}

// canadianToUS 函数设定在 exports 模块中，所有引入这个模块的代码可以使用它
exports.canadianToUS = canadian => roundTwo(canadian * canadianDollar); 

// USToCanadian 也设定在 exports 模块中
exports.USToCanadian = us => roundTwo(us / canadianDollar); 
```
exports 对象上只设定了两个属性。也就是说引入这个模块的代码只能访问到 canadianToUS 和 USToCanadian 这两个函数。而变量 canadianDollar 作为私有变量仅作用在 canadianToUS 和 USToCanadian 的逻辑内部，程序不能直接访问它。
使用这个新模块要用到 Node 的 require 函数，该函数以所用模块的路径为参数。Node 以同步的方式寻找模块，定位到这个模块并加载文件中的内容。Node 查找文件的顺序是先找核心模块，然后是当前目录，最后是 node_modules。
>关于require和同步 I/O
>
>require 是 Node 中少数几个同步 I/O 操作之一。因为经常用到模块，并且一般都是在文件顶端引入，所以把 require 做成同步的有助于保持代码的整洁、有序，还能增强可读性。
>但在 I/O 密集的地方尽量不要用 require。所有同步嗲用都会阻塞 Node，直到调用完成才能做其他事情。比如你正在运行一个 HTTP 服务器，如果在每个进入的请求上都用了 require，就会遇到性能问题。所以 require 和其他同步操作通常放在程序最初加载的地方。

下面这个是 test-currency.js 中的代码，它 require 了 currency.js 模块。
### 代码清单 2-2 引入一个模块（test_currency.js）
```javascript
// 用路径 ./ 表明模块跟程序脚本放在同一目录下
const currency = require('./currency');
console.log('50 Canadian dollars equals this amount of US dollar:');
// 使用 currency 模块的
// canadianToUS 函数
console.log(currency.canadianToUS(50));

console.log('30 US dolars equals this aomunt of Canadian dollars:');
// 使用 currency 模块的 USToCanadian 函数
console.log(currency.USToCanadian(30));
```
引入一个以 ./ 开头的模块意味着，如果你准备创建的程序脚本 test-currency.js 在 currency_app 目录下，那 currency.js 模块文件，如图 2-4 所示，应该也放在 currency_app 目录下。在引入时，.js 扩展名可以忽略。如果没有指明是 js 文件，Node 也会检查 json 文件，json 文件是作为 JavaScript 对象加载的。
![如果在 require 模块时把 ./ 放在前面，Node 会在被执行程序文件所在的目录下寻找这个模块](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E5%BC%95%E5%85%A5%E4%B8%80%E4%B8%AA%E6%A8%A1%E5%9D%97.png)
图 2-4 如果在 require 模块时把 ./ 放在前面，Node 会在被执行程序文件所在的目录下寻找这个模块
在 Node 定位到并计算好你的模块之后，require 函数会返回这个模块中定义的 exports 对象中的内容，然后你就可以用这个模块中的两个函数做货币交换了。
如果想把这个模块放到子目录中，比如 lib/，只要把 require 语句改成下面这样就可以了：
```javascript
const currency = require('./lib/currency');
```
组装模块中的 exports 对象是在单独的文件中组织可重用代码的一种简便方法。
# 2.3 用 module.exports 微调模块的创建

尽管用函数和变量组装 exports 对象能满足大多数的模块创建需要，但有时你可能需要用不同的模型创建该模块。
比如说，前面创建的那个货币转换器模块可以改成只返回一个 Currency 构造函数，而不是包含两个函数的对象。一个面向对象的实现看起来可能像下面这样：
```javascript
const Currency = require('./currency');
const canadianDollar = 0.91;
const currency = new Currency(canadianDollar);
console.log(currency.canadianToUS(50));
```
如果只需要从模块中得到一个函数，那从 require 中返回一个函数的代码要比返回一个对象的代码更优雅。
要创建只返回一个变量或函数的模块，你可能会以为只要把 exports 设定成你想返回的东西就行。但这样是不行的，因为 Node 觉得不能用任何其他对象、函数或变量给 exports 赋值。下面这个代码清单中的模块代码试图将一个函数赋值给 exports。
## 代码清单 2-3 这个模块不能用
```javascript
class Currency {
	constructor(canadianDollar) {
		this.canadianDollar = canadianDollar
	}
	
	roundTwoDecimals(amount) {
		return Math.round(amount * 100) / 100;
	}
	
	canadianToUS(canadian) {
		return this.roundTwoDecimals(canadian * this.canadianDollar);
	}
	
	USToCanadian(us) {
		return this.roundTwoDecimals(us / this.canadianDollar);
	}
}

exports.Currency; // 错误，Node 不允许重写 exports
```
为了让前面那个模块的代码能用，需要把 exports 换成 module.exports。用 module.exports 可以对外提供单个变量、函数或者对象。如果你创建了一个既有 exports 又有 module.exports 的模块，那它会返回 module.exports，而 exports 会被忽。
>导出的究竟是什么
>
>最终在程序里导出的是 module.exports。exports 只是对 module.exports 的一个全局引用，最初被定义为一个可以添加属性的空对象。exports.myFunc 只是 module.exports.myFunc 的简写。
>所以，如果把 exports 设定为别的，就打破了 module.exports 和 exports 之间的**引用关系**。可是因为真正导出的是 module.exports，那样 exports 就不能用了，因为它不再指向 module.exports 了。如果你想保留那个链接，可以像下面这样让 module.exports 再次引用 exports。
>```
>module.exports = exports = Currency;
>```
>根据需要使用 exports 或 module.exports 可以将功能组织成模块，规避掉程序脚本一直增长所产生的弊端。

# 2.4 用 node_modules 重用模块

要求模块在文件系统中使用相对路径存放，对于组织程序特定的代码很有帮助，但对于想要在程序间共享或跟其他人共享代码却用处不大。Node 中有一个独特的模块引入机制，可以不必知道模块在文件系统中的具体位置。这个机制就是使用 node_modules 目录。
前面那个模块的例子中引入的是 ./currency。如果省略 ./，只写 currency，Node 会遵循几个规则搜寻这个模块，如图 2-5 所示。
![查找模块的步骤](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E6%9F%A5%E6%89%BE%E6%A8%A1%E5%9D%97%E7%9A%84%E6%AD%A5%E9%AA%A4.png)
图 2-5 查找模块的步骤
用环境变量 NODE_PATH 可以改变 Node 模块的默认路径。如果用了它，在 Windows 中 NODE_PATH 应该设置为用分号分隔的目录列表，在其他操作系统中调用冒号分隔。
# 2.5 注意事项

尽管 Node 模块系统的本质简单直接，但还是有两点需要注意一下。
第一，如果模块是目录，在模块目录中定义模块的文件必须被命名为 inde.js，除非你在这个目录下一个叫 package.json 的文件里特别指明。要指定一个取代 index.js 文件，package.json 文件里必须有一个用 JavaScript 对象表示法（JSON）数据定义的对象，其中有一个名为 main 的键，指明模块目录内主文件的路径。图 2-6 中的流程图对这些规则做了汇总。
![当模块目录下有package.json文件时](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E5%BD%93%E6%A8%A1%E5%9D%97%E7%9B%AE%E5%BD%95%E4%B8%8B%E6%9C%89package.json%E6%96%87%E4%BB%B6%E6%97%B6.png)
图 2-6 当模块目录下有 package.json 文件时，你可以用 index.js 之外的其他文件定义自己的模块
下面是一个 package.json 文件的例子，它指定 currency.js 为主文件：
```json
{
	"main": "currency.js"
}
```
第二，Node 能把模块作为对象缓存起来。如果程序中的两个文件引入了相同的模块，第一个 require 会把模块返回的数据存到内存中，这样第二个 require 就不用再去访问和计算模块的源文件了。也就是说，在同一个进程中用 require 加载一个模块得到的是相同的对象。假设你搭建了一个 MVC Web 应用程序，它有一个主对象 app。你可以设置好那个 app 对象，导出它，然后在项目中的任何地方 require 它。如果你在这个 app 对象中放了一些配置信息，那你就可以在其他文件中访问这些配置信息的值，假定目录结构如下所示：
```
project
	app.js
	models
		post.js
```
图 2-7 展示了它的工作原理。
![在Web程序中共享app对象](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E5%9C%A8Web%E7%A8%8B%E5%BA%8F%E4%B8%AD%E5%85%B1%E4%BA%ABapp%E5%AF%B9%E8%B1%A1.png)
图 2-7 在 Web 程序中共享 app 对象
熟悉 Node 模块系统最好的办法是自己动手试一试，亲自验证一下本节所描述的 Node 的行为。在对模块的工作机制有了基本的认识后，接下来学习异步编程技术。
# 2.6 使用异步编程技术

如果你做过 Web 前端程序，并且遇到过界面事件（比如鼠标点击）触发的逻辑，那你就做过异步程序。服务端异步编程也一样：事件发生会触发响应逻辑。在 Node 的世界里流行两种功响应逻辑管理方式：回调和事件监听。
回调通常用来定义一次性响应的逻辑。比如对于数据库查询，可以指定一个回调函数来确定如何处理查询结果。这个回调函数可能会显示数据库查询结果，根绝这些结果做些计算，或者以查询结果为参数执行另一个回调函数。
事件监听器本质上也是一个回调，不同的是，它跟一个概念实体（事件）相关联，例如，当有人在浏览器中国点击鼠标时，鼠标点击就是一个需要处理的事件。在 Node 中，当有 HTTP 请求过来时，HTTP 服务器会发出一个 request 事件。你可以监听那个 request 事件，并添加一些响应逻辑。在下面这个例子中，因为用 EventEmitter.prototype.on 方法在服务器上绑定了一个监听器，所以每当有 request 事件发出时，服务器就会调用 handleRequest 函数：
```javascript
server.on('request', handleRequest);
```
一个 Node HTTP 服务器实例就是一个事件发射器，一个可以继承、能够添加事件发射及处理能力的类（EventEmitter）。Node 的很多核心功能都继承自 EventEmitter，你也能创建自己的事件发射器。
Node 有两种常用的响应逻辑组织方式，我们刚才用了其中一种，接下来要了解一下它的工作机制：
- 如何用回调处理一次性事件
- 如何用事件监听器响应重复性事件
- 异步编程的几个难点
先来看这个最常用的异步代码编写方式：使用回调。
# 2.7 用回调处理一次性事件

回调是一个函数，它被当作参数传给异步函数，用来描述异步操作完成之后要做什么。回调在 Node 开发中用得很怕频繁，比事件发射器用得多，并且用起来也很简单。
为了演示回调的用法，我们来做一个简单的 HTTP 服务器，让它实现如下功能：
- 异步获取存放在 JSON 文件中的文章的标题
- 异步获取简单的 HTML 模板
- 把那些标题组装到 HTML 页面里
- 把 HTML 页面发送给用户
最终结果如图 2-8 所示。
![来自 Web 服务器的 HTML 响应](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E4%BA%8C%E7%AB%A0%EF%BC%9ANode%20%E7%BC%96%E7%A8%8B%E5%9F%BA%E7%A1%80/%E6%9D%A5%E8%87%AAWeb%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%9A%84HTML%E5%93%8D%E5%BA%94.png)
图 2-8 来自 Web 服务器的 HTML 响应，从 JSON 文件中获取标题并返回一个 Web 页面
JSON 文件（titles.json）会被格式化成一个包含文章标题的字符串数组没，内容如下所示。
## 代码清单 2-4 一个包含文章标题的列表
```json
[
	"Kazakhstan is a huge country... what goes on there?",
	"This weather is making me craaazy",
	"My neighbor sort of howls at night"
]
```
HTML 模板文件（template.html） 如下所示，结构很简单，可以插入博客文章的标题。
## 代码清单 2-5 用来渲染博客标题的 HTML 模板
```html
<!doctype html>
<html>
	<head></head>
	<body>
		<h1>Latest Posts</h1>
		<ul><li>%</li></ul>
	</body>
</html>
```
获取 JSON 文件中的标题并渲染 Web 页面的代码如下所示（blog_recent.js）。
## 代码清单 2-6 在简单的程序中使用回调的例子
```javascript
const http = require('http');
const fs = require('fs');
// 创建 HTTP 服务器并用回调定义响应逻辑
http.createServer((req, res) => {
	if (req.url == '/') {
			// 读取 JSON 文件并用回调定义如何处理其中的内容
			fs.readFile('./titles.json', (err, data) => {
			// 如果出错，输出错误日志，并将客户端返回 "Server Error"
			if (err) {
				console.error(err)
				res.end('Server Error');
			} else {
				// 从 JSON 文本中解析数据
				const titles = JSON.parse(data.toString());
				// 读取 HTML 模板，并在加载完成后使用回调
				fs.readFile('./template.html', (err, data) => {
					if (err) {
						console.error(err);
						res.end('Server Error');
					} else {
						const tmpl = data.toString();
						// 组装 HTML 页面以显示博客标题
						const html = tmpl.replace('%', titles.join('</li><li>'));
						res.writeHead(200, { 'Content-Type': 'text/html' });
						// 将 HTML 页面发送给用户
						res.end(html);
					}
				})
			}
		})
	}
}).listen(8000, '127.0.0.1');
```
这个例子中的回调嵌套了三层：
```javascript
http.createServer((req, res)> { ...
	fs.readFile('./titles.json', (err, data) => { ...
		fs.readFile('./template.html', (err, data) => { ...
```
三层还算可以，但回调层数越多，代码看起来越乱，重构和测试起来也越困难，所以最好限制一下回调的嵌套层级。如果把每一层回调嵌套的处理做成命名函数，虽然表示相同逻辑所用的代码变多了，但维护、测试和重构起来会更容易。下面的代码功能跟代码清单 2-6 中的一样。
## 代码清单 2-7 创建中间函数以减少嵌套的例子
```javascript
const http = require('http');
const fs = require('fs');
// 客户端请求一开始会进到这里
http.createServer((req, res) => {
	// 控制权转交给了 getTitles
	getTitles(res);
}).listen(8000, '127.0.0.1');

// 获取标题，并将控制权转交给 getTemplate
function getTitles(res) {
	fs.readFile('./titles.json', (err, data) => {
		if (err) {
			headError(err. res)'
		} else {
			getTemplate(JSON.parse(data.toString()), res);
		}
	});
}

// getTemplate 读取模板文件，并将控制权转交给 formatHtml
function getTemplate(titles, res) {
	fs.readFile('./template.html', (err, data) => {
		if (err) {
			hadError(err, res);
		} else {
			formatHtml(titles, data.toString(), res);
		}
	});
}

// formatHtml 得到标题和模板，渲染一个响应给客户端
function formatHtml(titles, tmpl, res) {
	const html = tmpl.replace('%', titles.join('</li><li>'));
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(html);
}

// 如果这个过程中出现了错误，hadError 会将错误输出到控制台，并给客户端返回 “Server Error”
function hadError(err, res) {
	console.error(err);
	res.end('Server Error');
}
```
你还可以用 Node 开发中的另一种惯用法来减少由 if/else 引起的嵌套：尽早从函数中返回。下面的代码清单功能跟前面一样，但通过尽早返回的做法避免了进一步的嵌套。它还明确表示出了函数不应该继续执行的意思。
## 代码清单 2-8 通过尽早返回减少嵌套的例子
```javascript
const http = require('http');
const fs = require('fs');
http.createServer((req, res) => {
	getTitles(res);
}).listen(8000, '127.0.0.1');

function getTitles(res) {
	// 在这里不再创建一个 else 分支，而是直接 return，因为如果出错的话，也没必要继续执行这个函数了
	fs.readFile('./titles.json', (err, data) => {
		if (err) return hadError(err, res);
		getTemplate(JSON.parse(data.toStrinng()), res);
	});
}

function getTemplate(titles, res) {
	fs.readFile('./template.html', (err, data) => {
		if (err) return hadError(err, res);
		formatHtml(titles, data.toString(), res);
	})
}

function formatHtml(titles, tmpl, res) {
	const html = tmpl.replace('%', titles.join('</li><li>'));
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end(html);
}

function hadError(err, res) {
	console.error(err);
	res.send('Server Error');
}
```
你已经学过如何用回调为一次性任务定义响应了，比如上例中的读取文件和响应 Web 服务器请求，接下来我们学一学如何用事件发射器组织事件。
>Node 的异步回调惯例
>
>Node 中的大多数内置模块在使用回调时都会带两个参数：第一个用来放可能会发生的错误，第二个用来放结果。错误参数经常缩写为 err。
>下面这个是常用的函数签名的典型示例：
>```javascript
>const fs = require('fs');
>fs.readFile('./titles.json', (err, data) => {
>	if (err) throw err;
>	// 如果没有错误发生，则对数据进行处理
>});
>```

# 2.8 用事件发射器处理重复事件

事件发射器会触发事件，并且在那些事件被触发时能处理它们。一些重要的 Node API 组件，比如 HTTP 服务器、TCP 服务器和流，都被做成了事件发射器。你也可以创建自己的事件发射器。
我们之前说过，事件是通过监听器进行处理的，监听器是跟事件相关联的、当有事件出现时就会被触发的回调函数。比如 Node 中的 TCP socket，它有一个 data 事件，每当 socket 中有新数据时就会触发：
```javascript
socket.on('data', handleData);
```
我们看一下用 data 事件创建的 echo 服务器。
## 2.8.1 事件发射器示例

echo 服务器就是一个处理重复性事件的简单例子，当你给它发送数据时，它会把数据发回来。如图 2-9 所示。
下面的代码清单实现了一个 echo 服务器。当有客户端连接上来时，它就会创建一个 socket。socket 是一个事件发射器，可以用 on 方法添加jian'*t*监听器响应 data 事件。只要 socket 上有新数据过来，就会发出这些 data 事件。
### 代码清单 2-9 用 on 方法响应事件
```javascript
const net = require('net');
const server = net.createServer(socket => {
	// 当读取到新数据时处理的 data 事件
	socket.on('data', data => {
		// 数据被写回到客户端
		socket.write(data);
	});
});
server.listen(8888);
```
用下面这条命令可以运行 echo 服务器：
```shell
node echo_server.js
```
echo 服务器运行起来之后，你可以用下面这条命令连上去：
```shell
telnet 127.0.0.1 8888
```
每次通过 telnet 会话把数据发送给服务器，数据就会传回到 telnet 会话中。
## 2.8.2 响应只应该发生一次的事件

监听器可以被定义成持续不断地响应事件，如前面例子都是，也能被定义成只响应一次。下面的代码用了 once 方法，对前面那个 echo 服务器做了修改，让它会回应第一次发生过来的数据。
### 代码清单 2-10 用 once 方法响应单次事件
```javascript
const net = require('net');
const server = net.createServer(socket => {
	// data 事件只被处理一次
	socket.once('data', data => {
		socket.write(data);
	});
});
server.listen(8888); 
```
## 2.8.3 创建事件发射器：一个 PUB/SUB的例子

前面的例子用了一个带事件发射器的 Node 内置 API。然而你可以用 Node 内置的事件模块创建自己的事件发射器。
下面的代码定义了一个 channel 事件发射器，带有一个监听器，可以向加入频道的人做出响应。注意这里用 on（或者用比较长的 addListener）方法给事件发射器添加了监听器：
```javascript
const EventEmitter = require('events').EventEmitter;
const channel = new EventEmitter();
channel.on('join', () => {
	console.log('Welcome!');
});
```
然而这个 join 回调永远都不会被调用，因为你还没有发射任何事件。所以还要在上面的代码中加上一行，用 emit 函数发射这个事件：
```javascript
channel.emit('join');
```
>事件名称
>事件是可以具有任意字符串值的键：data、join 或某些长的让人发疯的事件名就行。只有一个事件是特殊的，那就是 error，我们马上就会看到它。

接下来看看如何用 EventEmitter  实现自己的发布/预订逻辑，做一个通信通道。如果运行代码清单 2-11 中的脚本，你就会得到一个简单的聊天服务器。聊天服务器的频道做成了事件发射器，能对客户端发出的 join 事件做出响应。当有客户端加入聊天室事件时，join 监听器逻辑会将一个针对改客户端的监听器附加到频道上，用来处理会将所有广播信息写入该客户端 socket 的 broadvase 事件。事件类型的名称，比如 join 和 broadcast，完全是随意取的。你也可以按自己的喜好给它们换个名字。
### 代码清单 2-11 用事件发射器实现的简单的的发布/预订系统
```javascript
const events = require('events');
const net = require('net');
const channel =new events.EventEmitter();;
channel.clients = {};
channel.subscriptions = {};
channel.on('join', function (id, client) {
	this.clients[id] = client;
	// 添加 join 事件的监听器，保存用户的 client 对象，以便程序可以将数据发送给用户
	this.subscriptions[id] = (senderId, message) => {
		// 忽略发出这一广播数据的用户
		if (id != senderId) {
			this.clients[id].write(message);
		}
	};
	// 添加一个专门针对当前用户的 broadcast 事件监听器
	this.on('broadcast', this.subscriptions[id]);
});

const server = net.createServer(client => {
	const id = `${client.remoteAddress}:${client.remotePort}`;
	// 当有用户连到服务器上时发出一个 join 事件，指明哦尼姑
	channel.emit('join', data => {
		data = data.toString();
		channel.emit('broadcast', id, data);
	});
});
server.listen(8888);
```
把聊天服务器跑起来后，打开一个新的命令行窗口，并在其中输入下面的命令进入聊天程序：
```shell
telnet 127.0.0.1 8888
```
如果你打开几个命令窗口，在其中任何一个窗口中输入的内容都将会被发送到其他所有窗口中。
这个聊天服务器还有一个问题，在用户关闭连接离开聊天室后，原来那个监听器还在，仍会尝试向已经断开的连接写数据。这样自然就会出错。为了解决这个问题，还要按照下面的代码清单把监听器添加到频道事件发射器上，并且向服务器的 close 事件监听器中添加发射频道的 leave 事件的处理逻辑。leave 事件本质上就是要移除原来给用户端添加的 broadcast 监听器。
### 代码清单 2-12 创建一个在用户断开连接时能“打扫战场”的监听
```javascript
// 创建 leave 事件的监听器
channel.on('leave', function(id) {
	channel.removeListener('broadcast', this.subscriptions[id]);
	// 移除指定客户端的 broadcast 监听器
	channel.emit('broadcast', id, `${id} has left this chatroom.\n`);
});

const server = net.createServer(client => {
	// 在用户断开连接时发出 leave 事件
	client.on('close', () => {
		channel.emit('leave', id);
	});
});

server.listen(8888);
```
如果出于某种原因你想停止聊天服务，但又不想关掉服务器，可以用 removeAllListeners 事件发射器方法去掉给定类型的全部监听器。下面是在我们的聊天服务器上使用这一方法的示例：
```javascript
channel.on('shutdown', () => {
	channel.emit('broadcase', '', 'The server hash shut down.\n');
	channel.removeAllListeners('broadcast');
});
```
然后你可以添加一个停止服务的聊天命令。为此需要将 data 事件的监听器改成下面这样：
```javascript
client.on('data', data => {
	data = data.toString();
	if (data === 'shutdown\r\n') {
		channel.emit('shutdown');
	}
	channel.emit('broadcast'm, id, data);
})
```
## 2.8.4 扩展事件监听器：文件监听器

如果你想在事件发射器的基础上构建程序，可以创建一个新的 JavaScript 类继承事件发射器。比如创建一个 Watcher 类来处理放在某个目录下的文件。然后可以用这个类创建一个工具，该工具可以监视目录（将放到里面的文件名都改成小写的，并将文件复制到一个单独目录中）。
设置好 Watcher 对象后，还需要加两个新方法扩展继承自 EventEmitter 的方法，代码如下所示。
### 代码清单 2-13 扩展事件发射器的功能
```javascript
const fs = require('fs');
const events = require('events');

// 扩展 EventEmitter，添加处理文件的方法
class Watcher extends events.EventEmitter {
	constructor(watchDir, processedDir) {
		super();
		this.watchDir = watchDir;
		this.proceseDir = processDir;
	}
	
	watch() {
		// 处理 watch 目录中的所有文件
		fs.readdir(this.watchDir, (err, files) => {
			if (err) throw err;
			for (var index in files) {
				this.emit('process', files[index]);
			}
		});
	}
	
	start() {
		// 添加开始监控的方法
		fs.watchFile(this.watchDir, () => {
			this.watch();
		})
	}
}

module.exports = Watcher;
```
watch 方法循环遍历目录，处理其中的所有文件。start 方法启动对目录的监控。监控用到了 Node 的 fs.watchFile 函数，所以当被监控的目录中有事情发生时，watch 方法会被触发，缓存遍历收监控的目录，并针对其中的每一个文件发出 process 事件。
定义好了 Watcher 类，可以用下面的代码创建一个 Watcher 对象：
```javascript
const watcher = new Watcher(watchDir, processedDir);
```
有了新创建的 Watcher 对象，你可以用继承事件发射器类的 on 方法设定每个文件的处理逻辑，如下所示：
```javascript
watch.on('process', (file) => {
	const watchFile = `${watchDir}/${file}`;
	const processedFile = `${processedDir}/${file.toLowerCase()}`;
	fs.rename(watchFile, processedFile, err => {
		if (err) throw err;
	});
});
```
现在所有必要逻辑都已经就位了，可以用下面这行代码启动对目录的监控：
```javascript
watcher.start();
```
把 Watcher 代码放到脚本中，创建 watch 和 done 目录，你应该能用 Node 运行这个脚本，把文件丢到 watch 目录中，然后看着文件出现在 done 目录下，文件名被改成小写。这就是用事件发射器创建新类的例子。
通过学习如何使用回调定义一次性异步逻辑，以及如何用事件发射器重复派发异步逻辑，你离掌控 Node 程序的行为又近了一步。然而你可能还想在单个回调或事件发射器的监听器中添加新的异步任务。如果这些任务的执行顺序很重要，你就会面对新的问题：如何准确控制一系列异步任务里的每个任务。
在我们学习如何控制任务的执行之前（2.10 节），先来看一看在编写异步代码时可能会碰到哪些难。
# 2.9 异步开发的难题

在创建异步程序时模，你必须密切关注程序的执行流程，并瞪大眼睛盯着程序的状态：事件轮询的条件、程序变量，以及其他随着程序逻辑执行而发生变化的资源。
比如说，Node 的事件轮询会跟踪着还没有完成的异步逻辑。只要有异步逻辑未完成，Node 进程就不会退出。一个持续运行的 Node 进程对 Web 服务器之类的应用来说很有必要，但对于命令行工具这种经过一段时间后就应该结束的应用却意义不大。事件轮询会跟踪所有数据库连接，直到它们关闭，以防止 Node 退出。
如果你不小心，程序的变量也可能会出现意想不到的变化。代码清单 2-14 是一段可能因为执行顺序而导致混乱的异步代码。如果例子中的代码能够同步执行，你可能肯定输出应该是 "The color is blue"。可这个例子是异步的，在 console.log 执行之前 color 的值还在变化，所以输出似乎 "The color is green"。
## 代码清单 2-14 作用域是如何导致 bug 出现的
```javascript
function asyncFunction(callback) {
	setTimeout(callback, 200);
}
let color = 'blue';
asyncFunction(() => {
	// 这个最后执行（200ms 之后）
	console.log(`The color is ${color}`);
});

color = 'green';
```
用 JavaScript 闭包可以“冻结” color 的值。在代码清单 2-15 中，对 asyncFunction 的调用被封装到了一个以 color 为参数的匿名函数里。这样你就可以马上执行这个匿名函数，把当前的 color 的值传递给它。而 color 变成了匿名函数的参数，也就是这个匿名函数内部的本地变量，当匿名函数外面的 color 值发生变化时，本地版的 color 不会受影响。
## 代码清单 2-15 用匿名函数保留全局变量的值
```javascript
function asyncFunction(callback) {
	setTimeout(callback, 200);
}

let color = 'blue';

(color => {
	asyncFunction(() => {
		console.log('The color is', color);
	});
})(color);

color = 'green';
```
现在你知道怎么用闭包控制程序状态了，接下来我们看看怎么让异步逻辑顺序执行，好让你可以掌控程序的流程。












































































