## 6.1.2 了解 Connect 中间件的工作机制

Connect 中间件就是 JavaScript 函数。这个函数一般会有三个参数：请求对象、响应对象，以及一个名为 next 的回调函数。一个中间件完成自己的工作，要执行后续的中间件时，可以调用这个回调函数。
在中间件运行之前，Connect 会用分派器接管请求对象，然后交给程序中的第一个中间件。图 6-1 是一个典型的 Connect 程序的示意图，由分派器和一组中间件组成，这些中间件包括日志记录、消息体解析器、静态文件服务器和定时中间件。
![了解 Connect 中间件的工作机制](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E5%85%AD%E7%AB%A0%EF%BC%9A%E6%B7%B1%E5%85%A5%E4%BA%86%E8%A7%A3%20Connect%20%E5%92%8C%20Express/%E4%B8%A4%E4%B8%AAHTTP%E8%AF%B7%E6%B1%82%E7%A9%BF%E8%BF%87Connect%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%9A%84%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F.png)
图 6-1 两个 HTTP 请求穿过 Connect 服务器的生命周期
## 6.1.3 组合中间件

Connect 中的 use 方法就是用来组合中间件的。我们先来定义两个中间件函数，然后把它们都添加到程序中。其中一个是之前那个例子里的 hello 函数，另外一个是 logger。
### 代码清单 6-1 使用多个 Connect 中间件
```javascript
const connect = require('connect');

// 输出 HTTP 请求的方法和 URL 并调用 next()
function logger(req, res, next) {
	console.log('%s %s', req.method, req.url);
}

// 用 "hello world" 响应 HTTP 请求
function hello(req, res) {
	res.setHeader('Content-Type', 'text/plain');
}

connect()
	.use(logger)
	.use(hello)
	.listen(3000);
```
这两个中间件的名称签名不一样：一个有 next，一个没有。因为后面这个中间件完成了 HTTP 响应，再也不需要把控制权交还给分派器了。
如前所示，use() 函数返回的是 Connect 程序的实例，支持方法链。不过并不一定要把 .use() 链起来，像下面这样也可以：
```javascript
const app = connect();
app.use(logger);
app.use(hello);
app.listen(3000);
```
有了这个简单的入门程序，我们来看看为什么 .use 的调用顺序很重要，以及如何策略地用这个顺序调整程序的工作方式。
## 6.1.4 中间件的顺序

中间件的顺序会对程序的行为产生显著影响。漏掉 next() 能停止执行，也可以通过组合中间件实现用户认证之类的功能。
中间件不调用 next 会怎么样？在之前那个入门程序中，logger 是第一个中间件，然后是 hello。Connect 将日志输出到控制台，然后返回 HTTP 响应。如果像下面这样把顺序倒过来会怎么样？
### 代码清单 6-2 错误：hello 中间件组件在 logger 组件前面
```javascript
const connect = require('connect');

// 总是调用 next()，所以后续中间件总会被调用
function logger(req, res, next) {
	console.log('%s %s', req.method, req.url);
	next();
}

// 不会调用 next()，因为组件响应了请求
function hello(req, res) {
	res.setHeader('Content-Type', 'text/plain');
	res.end('hello world');
}

const app = connect()
	// 因为 hello 不调用 next()，所以 logger 永远不会被调用
	.use(hello)
	.use(logger)
	.listen(3000);
```
这个例子是先调用 hello，程序如期返回响应结果。但 logger 永远也不会执行，因为 hello 没有调用 next()，所以控制权没有交回给分派器，它也不会调用下一个中间件。也就是说，如果某个中间件不调用 next()，那链在它后面的中间件就不会被调用。
图 6-2 给出了这个例子是如何跳过 logger 的，以及如何改正。
![中间件的顺序很重要](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E5%85%AD%E7%AB%A0%EF%BC%9A%E6%B7%B1%E5%85%A5%E4%BA%86%E8%A7%A3%20Connect%20%E5%92%8C%20Express/%E4%B8%AD%E9%97%B4%E4%BB%B6%E7%9A%84%E9%A1%BA%E5%BA%8F%E5%BE%88%E9%87%8D%E8%A6%81.png)
图 6-2 中间件的顺序很重要
正如你所看到的，像这样把 hello 放到 logger 前面并没什么用，但只要运用得当，排序是可以带来好处的。
## 6.1.5 创建可配置的中间件

介绍完中间件的基础知识，可以深入研究一些细节了。接下来先看看如何创建更通用的可重用中间件。
为了做到可配置，中间件一般会遵循一个简单的惯例：用一个函数返回另一个函数（闭包）。这种可配置中间件的基本结构如下所示：
```javascript
function setup(options) {
	// 设置逻辑
	// 在这里做中间件的初始化
	return function(req, res, next) {
		// 中间件逻辑
		// 即使被外部函数返回了，仍然可以访问 options
	}
}
```
这种中间件的用法如下：
```javascript
app.use(setup({ some: 'options' }))
```
注意 app.use 中的 setup 函数，之前放的是对中间件函数的引用。
本节会这项技术构建一个可重用、可配置的中间件：数据格式可配置的 logger。
前面创建的 logger 中间件不可配置。要输出请求的 req.method 和 req.url 是写死在代码里的。如果将来想改变 logger 输出的信息该怎么办？
在实际工作中，可配置的中间件跟之前创建的不可配置中间件用起来是一样的，只是可以向其中传入额外的参数来改变它的行为。可配置中间件的使用和下面这个例子差不多，logger 能接收一个字符串参数，描述输出的日志格式：
```javascript
const app = connect()
	.use(logger(':method :url'))
	.use(hello);
```
为了让 logger 可配置，需要先定义一个 setup 函数，它能接受一个字符串参数（此例中名为 format）。setup 的返回结果是一个函数，即 Connect 所用的中间件。即便被 setup 返回后，这个中间件函数仍能访问 format，因为它们是在同一个 JavaScript 闭包内定义的。logger 会将 format 中的标记替换为 req 对象中的相应属性，输出到控制台，然后调用 next()。代码如下所示。
### 代码清单 6-3 可配置的 Connect 中间件 logger
```javascript
// setup 函数可以用不同的配置调用多次
function setup(format) {
	// logger 组件用正则表达式匹配请求属性
	const regexp = /:(\w+)/g;
	
	// Connect 使用的真实 logger 组件
	return function createLogger(req, res, next) {
		// 用正则表达式格式化请求的日志条目
		const str = format.replace(regexp, (match, property) => {
			return req[property];
		});
		// 将日志条目输出到控制台
		console.log(err);
		// 将控制权交给下一个中间件组件
		next();
	}
}

// 直接导出 logger 的 setup 函数
module.exports = setup;
```
现在这个 logger 成了可配置的中间件，所以，可以在同一程序中给 .use() 传入不同配置的 logger，或者在将来开发的程序中重用这段代码。整个 Connect 社区都在用这种可配置中间件的概念，并且为了保持一致性，所有 Connect 核心中间件都是可配置的。
要使用代码清单 6-3 中的中间件 logger，需要给它传一个字符串，指明请求对象中的属性。比如 `.use(setup(':method :url'))` 会输出所有请求的 HTTP 方法（GET、POST 等）和 URL。
在转战 Express 之前，先看看 Connect 对错误处理的支持。
## 6.1.6 使用错误处理中间件

所有程序都有错误。不管是在系统层面还是在用户层面，面对错误，甚至是无法预料的错误，做到未雨绸缪才是明智之举。Connect 中有一种用来处理错误的中间件变体，跟常规的中间件相比，除了请求、响应对象外，错误处理中间件的参数中还多了一个错误对象。
Connect 刻意将错误处理做到极简，让开发人员指明应该如何处理错误。比如说，可以只让系统和程序级错误（比如 "undefined 的变量 foo"）通过中间件，或者只让用户错误（“密码无效”）通过，或者让两者的组合通过。Connect 让你自己选择最佳的处理策略。
接下来会介绍错误处理中间件的工作机制以及一些实用的模式：
- 用 Connect 的默认错误处理器
- 自行处理
我们先看看不进行任何配置时 Connect 是如何处理错误的。
### 6.1.6.1 用 Connect 的默认错误连接器

因为函数 foo() 没有定义，所以下面这个中间件会抛出错误 ReferenceError：
```javascript
const connect = require('connect');

connect()
	.use((req, res) => {
		foo();
		res.setHeader('Content-Type', 'text/plain');
		res.end('hello world');
	})
.listen(3000);
```
Connect 默认的处理是返回响应状态码 500，响应主体是文本 Internal Server Error 和错误的详细信息。这无可厚非，但在真正的程序中，一般还会对这些错误做一些特殊处理，比如将它们发送给一个日志守护进程。
### 6.1.6.2 自行处理程序错误

Connect 也支持用错误处理中间件自行处理错误。比如说，为了在开发时看到简单快捷的错误报告，你可能想用 JSON 格式发送错误信息：而在生产环境中，为了不把敏感的内部信息（比如栈跟踪、文件名和行号等）暴露给潜在的攻击者，你可能只想发送一个简单的服务器错误响应。
错误处理中间件函数必须有四个参数：err、req、res 和 next，如代码清单 6-4 所示，而常规的中间件只有 req、res 和 next 三个参数。下面这个错误处理中间件的完整代码（带服务器部分）在 ch06-connect-and-express/listing6_4 中。
### 代码清单 6-4 Connect 中的错误处理中间件
```javascript
const env = process.env.NODE_ENV || 'development';

function errorHandler(err, req, res, next) {
	res.statusCode = 500;
	switch(env) {
		case 'development':
			console.error('Error:');
			console.error(err);
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(err));
			break;
		default:
			res.end('Server error');
	}
}

module.exports = errorHandler;
```
用 NODE_ENV 设定程序的模式 Connect 一般会根据环境变量 NODE_ENV(process.env.NODE_ENV) 来切换不同服务器环境（比如生产环境和开发环境）下的行为。
当 Connect 遇到错误时，它会切换，只去调用错误处理中间件，如图 6-3 所示。
![引发了错误的 HTTP 请求在 Connect 服务器中的生命周期](https://backend-1257950569.cos.ap-guangzhou.myqcloud.com/Node.js%E5%AE%9E%E6%88%98%EF%BC%88%E7%AC%AC%E4%BA%8C%E7%89%88%EF%BC%89/%E7%AC%AC%E5%85%AD%E7%AB%A0%EF%BC%9A%E6%B7%B1%E5%85%A5%E4%BA%86%E8%A7%A3%20Connect%20%E5%92%8C%20Express/%E5%BC%95%E5%8F%91%E4%BA%86%E9%94%99%E8%AF%AF%E7%9A%84%20HTTP%20%E8%AF%B7%E6%B1%82%E5%9C%A8%20Connect%20%E6%9C%8D%E5%8A%A1%E5%99%A8%E4%B8%AD%E7%9A%84%E7%94%9F%E5%91%BD%E5%91%A8%E6%9C%9F.png)
图 6-3 引发了错误的 HTTP 请求在 Connect 服务器中的生命周期
假设有一个允许用户登录到管理区域的博客程序。如果负责用户路由的中间件引发了一个错误。则中间件 blog 和 admin 都会被跳过，因为他们不是错误处理中间件（只有三个参数）。然后 Connect 看到接受错误参数的 errorHandler，就会调用它。中间件看起来像下面这样：
```javascript
connect()
	.use(router(require('./routes/user')))
	.use(router(require('./routes/blog'))) // 跳过
	.use(router(require('./routes/admin'))) // 跳过
```
基于中间件的执行顺序短路某些功能是组织 Express 程序的基本概念。对 Connect 有了基本的了解后，该去看看 Express。



































