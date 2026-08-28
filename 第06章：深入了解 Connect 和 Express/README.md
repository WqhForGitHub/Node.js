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

