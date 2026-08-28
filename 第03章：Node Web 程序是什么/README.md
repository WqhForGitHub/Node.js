本章介绍的内容全部都是关于 Node Web 程序，其创意来自 Instapaper 和 Pocket 这样的 “回头再看”网站。涉及的工作包括开始一个新的 Node 项目、管理依赖项、创建 RESTfulAPI、把数据保存到数据库中，以及用模板做一个用户界面。虽然看起来有很多内容，但不用担心，我们还会在后续章节中详细讲解这里提到的每一项工作。
左侧的“回头再看”页面剥离了目标网站的无关元素，只留下了标题和内容猪蹄。更重要的是这篇文章被永久存放到了数据库中，也就是说即便将来连原始文章都找不到了，你还是读到她。
在开始搭建 Web 程序之前，应该先创建一个新项目。接下来我们会介绍如何从头开始创建一个 Node 项目。
# 3.1 了解 Node Web 程序的结构

典型的 Node Web 程序是由下面几部分组成的：
- package.json - 一个包含依赖项列表和运行这个程序的命令的文件
- public/ - 静态资源文件夹，CSS 和客户端 JavaScript 都放在这里
- node_modules/ - 项目的依赖项都会装到这里
- 放程序代码的一个或多个 JavaScript 文件。
程序代码一般又会分成下面几块：
- app.js 或 index.js - 设置程序的代码
- models/ - 数据库模型
- views/ - 用来渲染页面的模板
- controllers/ 或 routes/ - HTTP 请求处理器
- middlewares/ - 中间件组件
如何组织程序时间是你的自由：大部分 Web 框架都很灵活，并且需要配置。但大多数程序都是按照上面给出的结构组织的。
最好的学习方法就是亲自动手实践，所以让我们看看老练的 Node 程序员是如何创建 Web 程序框架的。
## 3.1.1 开始一个新的 Web 程序

要创建一个新的 Web 程序，需要先做一个新的 Node 项目。如果你忘记怎么做了，可以回去温习一下第 2 章。其实很简单，只需要创建一个目录，然后运行 npm init，记得加上接受所有默认值的参数：
```shell
mkdir later
cd later
npm init -fy
```
有了新项目，然后呢？大多数人都会用 npm 上的模块来降低开发难度。Node 自带了一个 http 模块，它有个服务器。但使用 http 模块依然需要做很多套路化的开发工作，所以我们一般会选择使用更便捷的 Express。下面来看一下怎么安装。
### 3.1.1.1 添加依赖项

要添加项目依赖项，可以用 npm install。下面这个就是安装 Express 的命令：
```shell
npm install --save express
```
如果现在看一下 package.json，你应该会看到 Express 已经给加上去了。也就是说 package.json 中应该会有类似于下面这样的代码：
```json
"dependencies": {
	"express": "^4.14.0"
}
```
Express 模块也应该装在了这个项目的 node_modules/ 文件夹下。如果想卸载 Express，可以运行 npm rm express --save。这个命令会把它从 node_modules/ 中删除，还会更新 package.json 文件。
### 3.1.1.2 一个简单的服务器

Express 以 Node 自带的 http 模块为基础。致力于在 HTTP 请求和响应上来建模 Web 程序。
为了做出一个最基本的程序，我们需要用 express() 创建一个程序实例，添加路由处理器，然后将这个程序实例绑定到一个 TCP 窗口上。下面是最基本的程序所需的全部代码：
```javascript
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
	res.send('Hello World');
});

app.listen(port, () => {
	console.log(`Express web app available at localhost: ${port}`)
});
```
看起来并不像你想的那么复杂，将这段代码放到 index.js 文件中，用 node index.js 运行它。然后访问 [[http://localhost:3000]] 看一下结果。每个程序的运行命令可能会不太一样，记起来很麻烦，所以大部分人会用 npm 脚本解决这个问题。
### 3.1.1.3 npm 脚本

启动服务器的命令（node index.js）可以保存为 npm 脚本，打开 package.json 文件，在 scripts 里添加一个 start 属性：
```json
"scripts": {
	"start": "node index.js",
	"test": "echo \"Error: no test specified\" && exit 1"
}
```
现在只要运行 npm start 就可以启动程序了。如果你看到有错误提示说端口 3000 已经被占用，那么可以运行 PORT=3001 npm start 使用另外一个端口。npm 脚本可以做很多事情：构建客户端包、执行测试、生成文档等。它基本上就是一个微型脚本调用工具。，所以只要你喜欢，放什么都行。
## 3.1.2 跟其他平台比一比

如果用 PHP 实现上面那个程序，代码如下：
```php
<?php echo `<p>Hello World</p>`; ?>
```
只有一行，并且一看就明白，那么这个更加复杂的 Node 示例有什么优点呢？二者是编程范式上的区别：用 PHP，程序员是页面。用 Node，程序是服务器。这个 Node 示例可以完全控制请求和响应，不用配置服务器就可以做所有事情。如果要用 HTTP 和程序逻辑分析，它们是程序的一部分。
与其把 HTTP 服务器的配置分离出去，不如把它们放在一起，也就是放在相同的目录下。因此 Node 程序更容易部署和管理。
npm 也让 Node 程序的部署变得更容易了。因为各自的依赖项是装在项目里的，所以同一系统上的不同项目间不会发生冲突。
## 3.1.3 然后呢

现在你已经掌握了用 npm init 创建项目和用 npm install --save 安装依赖项的技巧，可以快速创建新的项目了。太棒了，你能把自己的新想法变成新项目了。比如说，你对一个热门的 Web 框架感兴趣，想要尝试一下，就可以创建一个新目录，运行 npm init，然后用 npm 安装那个框架模块。
搞定了这些，就可以开始写代码了。到了这一步，你可以在项目里添加 JavaScript 文件，用 require 加载之前通过 npm install --save 安装的模块。现在我们的重点是大部分 Web 程序员接下来要做的事情，即添加一些 RESTful 路由。这能我们确定程序的 API，以及确定需要哪些数据库模型。
# 3.2 搭建一个 RESTful Web 服务

你的程序需要一个 RESTful Web 服务，以便像 Instapaper 和 Pocket 那样创建和保存文件。为了将杂乱的 Web 页面变成整洁的文章，这个服务需要用到一个模块，类似最早的 Readability 服务。
设计 RESTful 服务时，要想好需要哪些操作，并将它们映射到 Express 里的路由上。就此例而言，需要实现保存文章、获取文章、获取包含所有文章的列表和删除不再需要的文章这几个功能。分别对应下面这些路由：
- POST       /articles            创建新文章
- GET         /articles/:id       获取指定文章
- GET         /artoc;es           获取所有文章
- DELETE   /articles/:id       删除指定文章
在考虑数据库和 Web 界面等问题之前，我们先重点解决如何用 Express 创建 RESTful 资源的问题。你可以用 cURL 向示例程序发起请求，然后再逐步实现数据存储等更加复杂的操作，让它越来越像一个真正的 Web 程序。
下面这个简单的 Express 程序实现了这些路由，不过现在是用 JavaScript 数组来存储文章的。
## 代码清单 3-1 RESTful 路由示例

```javascript
const express = require('express');
const app = express();
const articles = [{ title: 'Example' }];

app.set('port', process.env.PORT || 3000);

// 获取所有文章
app.get('/articles', (req, res, next) => {
	res.send(articles);
});

// 创建一篇文章
app.post('/articles', (req, res, next) => {
	res.send('OK');
});

// 获取指定文章
app.get('/articles/:id',, (req, res, next) => {
	const id = req.params.id;
	console.log('Fetching:', id);
	res.send(articles[id]);
});

// 删除指定文章
app.delete('/articles/:id', (req, res, next) => {
	const id = req.params.id;
	console.log('Deleting:', id);
	delete articles[id];
	res.send({ message: 'Deleted' })
});

app.listen(app.get('port'), () => {
	console.log('App started on port', app.get('port'));
});

module.exports = app;
```
将这段代码保存为 index.js，然后就可以用 node index.js 运行了。请按下面的步骤使用这个例子：
```shell
mkdir listing3_1
cd listing3_1
npm init -fy
npm install --save express@4.12.4
```
第 2 章详细介绍了如何创建新的 Node 项目。
>示例代码的运行及修改
>
>在运行这些示例代码时，每次修改之后一定要记得重启服务器。重启方法是在按住 Ctrl-X 结束 Node 进程，然后再用 node index.js 启动它。
>例子中的代码全在代码清单中，所以你应该可以按顺序把它们组合成一个可以运行的程序。如果无法运行，可以从图灵社区下载本书中的代码。

代码清单 3-1 中有一个示例数据数组，用 Express 的 res.send 方法发送 JSON 响应时返回的所有文章都在这个数组。Express 能自动将数组转换成 JSON 响应，非常适合制作 REST API。
这个例子也可以用同样的办法发送一篇文章。甚至可以用标准的 JavaScript delete 关键字和 URL 中指定的数字 ID 删除一篇文章。可以在路由字符串中指定参数，比如 /articles/:id，然后用 res.params.id 获取 URL 中对应位置的值。
代码订单 3-1 还没实现创建文章的功能，因为那需要一个请求体解析器，我们下一节再讲这个。现在先看看如何用 cURL 访问这个例子。
用 node index.js 把这个例子跑起来之后，可以用浏览器或 cURL 向它发送请求。要获取一篇文章，可以运行下面的命令：
```shell
curl http://localhost:3000/articles/0
```
要获取所有文章，可以请求 /articles：
```shell
curl http://localhost:3000/articles
```
甚至可以删除一篇文章：
```shell
curl -X DELETE http://localhost:3000/articles/0
```
但为什么说不能创建文章呢？主要是因为处理 POST 请求需要消息体解析。之前 Express 有个内置的消息体解析器，但因为实现方法太多，所以开发人员把它分离出来做成了一个独立的模块。
消息体解析器知道如何接收 MIME-encoded（多用途互联网邮件扩展）POST 请求消息的主体部分，并将其转换成代码可用的数据。一般来说，它给出的是易于处理的 JSON 数据。只要网站上有涉及提交表单的请求，服务器端就肯定会有一个消息体解析器来参与这个请求的处理。
可以运行下面的命令添加受到官方支持的消息体解析器：
```shell
npm install --save body-parser
```
接下来像下面的代码清单中那样，在靠近文件顶部的地方加载这个消息体解析器。如果你一直在跟着我们的进度，可以将它保存到代码清单 3-1 所在的目录（listing3_1）中，但在本书源码职工我们新给它建了个目录（ch03-what-is-a-node-web-app/listing3_2）。
## 代码清单 3-2 添加消息体解析器
```javascript
const express = require('express');
const app = express();
const articles = [{ title: 'Example' }];
const bodyParser = require('body-parser');

app.set('port', process.env.PORT || 3000);

// 支持编码为 JSON 的请求消息体
app.use(bodyParser.json());
// 支持编码为表单的请求消息体
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/articles', (req, res, next) => {
	articles.push(article);
	res.send(article);
});
```
这样一来程序新增了两个很实用的功能：JSON 消息体解析的表单编码消息体解析。还新增了一个非常简单的文章创建功能：如果发送一个带有 title 域的 POST 请求，文章数组中会增加一篇新文章。下面是发出这样请求的 cURL 命令：
```shell
curl --data "title=Example 2" http://localhost:300/articles
```
恭喜你，这已经跟真正的 Web 程序差不多了。你只需要再完成两个任务就大功告成了。第一个任务是将数据永久保存在数据库里，第二个任务是为网上找到的文章生成一个可读版本。
# 3.3 添加数据库

就往 Node 程序中添加数据库而言，并没有一定之规，但一般会涉及下面几个步骤。
（1）决定想要用的数据库系统
（2）在 npm 上看看那些实现了数据库驱动或对象-关系映射（ORM）的热门板块
（3）用 npm --save 将模块添加到项目中
（4）创建模型，封装数据库访问 API
（5）把这些模型添加到 Express 路由中
在添加数据库之前，我们还是先在 Express 中添加第（5）步的路由处理代码。程序中的 HTTP 路由处理器会向模型发出一个简单的调用。这里有个例子：
```javascript
app.get('/articles', (req, res, err) => {
	Aricle.all((err, articles) => {
		res.send(articles);
	});
});
```
这个 HTTP 路由是用来获取所有文章的，所以对应的模型方法应该类似于 Article.all。这要取决于数据库 API，一般来说应该是 Article.find({}, cb) 和 Article.fetchAll().then(cb)，其中的 cb 是回调（callback）的缩写。
数据库系统这么多，怎么决定该选哪个呢？这个例子中选了 SQLite，至于理由，且听我们慢慢道来。
>选哪个数据库
>
>在这个项目里，我们准备用 SQLite，还有热门的 sqlite3 模块。SQLite 是进程内数据库。所以很方便：你不需要在系统上安装一个后台运行的数据库。你添加的所有数据都会写到一个文件里，也就是说程序停掉后再起来时数据还在，所以非常适合入门学习时间。

## 3.3.1 制作自己的模型 API

文章应该能被创建、被获取、被删除，所以模型类 Article 应该提供下面这些方法：
- Article.all(cb)：返回所有文章
- Article.find(id, cb)：给定 ID，找到对应的文章
- Article.create({ titlte, content }, cb)：创建一篇有标题和内容的文章
- Article.delete(id, cb)：根据 ID 删除文章
这些都可以用 sqlite3 模块实现。有了这个模块，我们可以用 db.all 获取多行数据，用 db.get 获取一行数据。不过先要有数据库连接。
下面的代码清单演示了如何在 Node 中使用 SQLite 实现上述功能。这段代码应该存在 db.js 中，跟代码清单 3-1 那个文件放到同一个文件夹中。
### 代码清单 3-3 模板类 Article
```javascript
const sqlite3 = require('sqlite3').verbose();
const dbName = 'later.sqlite';
// 连接到一个数据库文件
const db = new sqlite3.Database(dbName);

db.serialize(() => {
const sql = `
	CREATE TABLE IF NOT EXISITS articles
		(id integer primary keym title, content TEXT)
`;
// 如果还没有，创建一个 "articles"表
db.run(sql);
});

class Article {
	static all(cb) {
		// 获取所有文章
		db.all('SELECT * FROM articles'm, cb);
	}
	
	static find(db) {
		// 选择一篇指定的文章
		db.get('SELECT * FROM articles WHERE id = ?', id, cb);
	}
	
	static create(data, cb) {
		const sql = 'INSERT INTO articles(title, content) VALUE (?, ?)';
		// 问号表示参数
		db.run(sql, data.title, data.content, cb);
	}
	
	static delete(id, cb) {
		if (!id) return cb(new Error('Please provide an id'));
		db.run('DELETE FROM articles WHERE id = ?', id, cb);
	}
}

module.exports = db;
module.exports.Article = Article;
```
这个例子中创建了一个名为 Article 的对象，它可以用标准 SQL 和 sqlite3 模块对象、获取和删除数据。首先用 sqlite3.Database 打开一个数据库文件，然后创建表 articles。这里用到了 SQL 语法 IF NOT EXISTS，以防一不小心重新运行时删除之前的表重新创建一。
数据库和表准备好之后，这个程序就可以继续就可以进行查询了。用 sqlite6 的 all 方法可以获取所有查询语句中。最后，可以用 run 方法插入和删除数据。
我们还需要用 npm install --save sqlite3 安装 sqlite3，写作本书时它的版本号是 3.1.8.
基本的数据库功能已经实现了，接下来我们将它添加到代码清单 3-2 的 HTTP 路由中。
下面这段代码添加了所有方法，除了 POST。（因为需要用到 readability 模块，但你还没有装好，所以要单独处理）。
### 代码清单 3-4 将 Article 模块添加到 HTTP 路由中

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
// 加载数据库模块
const Article = require('./db').Article;

app.set('port', process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/articles', (req, res, next) => {
	// 获取所有文章
	Articles.all((err, articles) => {
		if (err) return next(err);
		res.send(articles);
	})
});

app.get('/articles/:id', (req, res, next) => {
	const id = req.params.id;
	// 找到指定文章
	Aricle.find(id, (err, article) => {
		if (err) return next(err);
		res.send(article);
	})
});

app.delete('/articles/:id', (req, res, next) => {
	const id = req.para,s.id;
	// 删除文章
	Article.delete(id, (err) => {
		if (err) return next(err);
		res.send({ message: 'Deleted' });
	})
});

app.listen(app.get('port'), () => {
	console.log('App started on port', app.get('port'));
});

module.exports = app;
```
代码清单 3-4 假设你已经把代码 3-3 存为了同一目录下的 db.js 文件。Node 会加载那个模块，然后用它获取所有文章，查找特定文章和删除一篇文章。
最后一件事情是实现创建文章的的功能。因此需要下载文章，还要用神奇的 readabiity 算法处理它们。我们需要一个来自 npm 的模块。
## 3.3.2 让文章可读并把它存起来

RESTful API 已经搭建好了，数据也可以持久化到数据库中了，接下来该写的代码把网页转换成简化版的阅读视图了。不过我们不用自己实现，因为 npm 中已经有这样的模块了。
在 npm 上搜索 readabillity 会找到很多模块。我们试一下 node-readability（写作本书时是 1.0.1 版）。用 npm install node-readability --save 安装它。这个模块提供了一个异步函数，可以下载指定 URL 的页面并将 HTML 抓换成简化版。下面这段代码演示了 node-readability 的用法。如果你想试试，可以把这里的代码和代码清单 3-5 中的代码添加到 index.js 文件中：
```javascript
const read = require('node-readability');
const url = 'http://www.manning.com/cantelon2/';
read(url, (err, result) => {
	// 结果有 .title 和 .content
});
```
还可以和数据库类结合起来，用 Article.create 方法保存文章：
```javascript
read(url, (err, result) => {
	Article.create(
		{ title: result.title, content: result.content },
		(err, article) => {
			// 将文章保存到数据库中
		}
	)
})
```
打开 index.js，添加新的 app.post 路由处理器，用上面的方法实现下载和保存文章的功能。综合我们上面学到的所有知识，即关于 Express 中的 HTTP POST 和消息体解析器，可以得出下面这段代码。
### 代码清单 3-5 生成可读的文章并保存
```javascript
const read = require('node-readability');

// .....代码清单 3-4 中给出的代码

app.post('/articles', (req, res, next) => {
	// 从 POST 消息体中得到 URL
	const url = req.body.url;
	
	read(url, (err, result) => {
		// 用 readability 模块获取这个 URL 指向的页面
		if (err || !result) res.status(500).send('Error downloading articles');
		Article.create(
			{ title: result.title, content: result.content },
			(err, article) => {
				if (err) return next(err);
				// 文章保存成功后，发送状态码为 200 的响应
				res.send('OK');
			}
		)
	})
})
```
在这段代码中，先从 POST 消息体中得到 URL，然后用 node-readability 模块获取这个 URL 指向的页面。用模型类 Article 保存文章。如果有错误，将处理权交给 Express 的中间件栈，否则，将 JSON 格式的文章发送给客户端。
你可以用 --data 参数给这个例子发送要给 POST 请求：
```shell
curl --data "url=http://manning.com/canteln2/" http://localhost:3000/articles
```
经过前面这些章节，我们做了很多工作：添加了一个数据库模块，创建了一个封装了数据库模块的 JavaScript API，并将它绑到了 RESTful API 上。作为服务器开发人员，你将来会做很多这样的工作。本书后续章节还会介绍数据库 MongoDB 和 Redis 方面的知识。
我们的程序现在已经可以保存文章了，也可以获取它们。为了能够阅读这些文章，还需要添加 Web 界面。
# 3.4 添加用户界面

给 Express 项目添加界面需要做几件事。首先是使用模板引擎。我们会简单地介绍一下如何安装模板引擎，并用它渲染模板。程序还徐雅服务静态文件，比如 CSS。在渲染木板和编写 CSS 之前，你还需要了解，如何在必要时让前面例子中的路由处理器同时支持 JSON 和 HTML 响应。
## 3.4.1 支持多种格式

之前我们用 res.send() 往客户端发送 JavaScript 对象。用 cURL 发送请求时，JSON 很方便，因为在控制台里看起来很清晰。但在现实应用中，这个程序还需要支持 HTML。怎么才能同时支持这两种格式呢？
基本做法是用 Express 的 res.format 方法。它可以根据请求发送相应格式的响应。它的用法如下所示，提供一个包含格式机及对应的响应函数的列表：
```javascript
res.format({
	html: () => (
		res.render('articles.ejs', { articles: articles });
	),
	json: () => {
		res.send(articles);
	}
});
```
在这段代码中，res.render 会渲染 view 文件夹下的模板 articles.ejs。但这需要安装模板引擎并创建相应的模板。
## 3.4.2 渲染模板

模板引擎有很多，EJS（嵌入式 JavaScript）属于简单易学那种。从 npm 上安装 EJS 模块（写作本书时 EJS 的版本号是 2.3.1）：
```shell
npm install ejs --save
```
res.render 可以渲染 EJS 格式的 HTML 文件。如果你换掉代码清单 3-4 中 app.get('/articles') 路由处理器中的 res.send(articles)，在浏览器中访问 [[http://localhost:3000/articles]]，程序应该会尝试渲染 articles.ejs。
接下来在 view 文件夹中创建模板 articles.ejs，你可以用下面代码清单中这个完整的模板。
### 代码清单 3-6 Article 列表模板
```javascript
// 包含另一个模板
<% include head %>
<ul>
	// 循环便利每篇文章并渲染它
	<% articles.forEach((article) => %{
		<li>
			<a href="/articles/<%=article.id %>">
				// 将文章的标题作为链接文本
				<%= articles.title %>
			</a>
		</li>
	<% })> %>
</ul>
<% include foot %>
```
文章列表模板在内部嵌入了页眉和页脚模板，具体代码请见下面的代码清单。这是为了避免在每个模板文件中重复这两部分代码。文章列表的循环遍历是用标准的 JavaScript 循环 forEach 实现的，文章的 ID 和标题是用 EJS 的 `<%=value %>`语法嵌入到模板中的。
下面是页眉模板示例，保存为 views/head.ejs：
```html
<html>
	<head>
		<title>Later</title>
	</head>
	<body>
		<div class="container">
		</div>
	</body>
</html>
```
这是对应的页脚（保存为 views/foot.ejs）
res.format 也可以用来显示指定的文章，从这儿开始变得有意思了，因为按照这个程序的要求，文章看起来应该简洁易读。
## 3.4.3 用 npm 管理客户端依赖项

模板搞定了，接下来就该添加样式了。我们不用自己创建样式，重用已有的样式会更简单，甚至这也能用 npm 来做。热门的 Bootstrap 客户端框架也在 npm 上，把它加到项目中：
```shell
npm install bootstrap --save
```
如果看一下 node_modules/bootstrap/，应该会看到 Bootstrap 项目的源码。然后，在 dist/css 文件夹中有来自 Bootstrap 的 CSS 文件。要使用这些文件，需要让服务器响应静态文件请求。
### 3.4.3.1 响应静态文件请求

Express 自带了一个名为 express.static 的中间件，可以给浏览器发送客户端 JavaScript、图片和 CSS 文件。只要将它指向包含这些文件的目录，浏览器就能访问到这些文件了。
在靠近 Express 主文件（index.js）的顶部，有加载项目u所需的中间件的代码：
```javascript
app.use(bodyParser.json());
app.use(bodyParser.urlencoded( extended: true ));
```
要加载 Bootstrap 的 CSS，用 express.static 将文件注册到恰当的 URL 上：
```javascript
app.use(
	'/css/bootstrap.css',
	express.static('node_modules/bootstrap/dist/css/bootstrap.css')
);
```
接下来我们把 /css/bootstrap.css 添加到模板中，来获得一些酷炫的 Bootstrap 样式。views/head.ejs 看起来应该是这样的：
```html
<html>
	<head>
		<title>later;</title>
		<link rel="stylesheet" href="/css/bootstrap.css">
	</head>
</html>
```
这只是 Bootstrap 的 CSS。它还有很多文件，包括图标、字体以及 jQuery 插件。你可以往项目里添加更多文件，或者工具把它们打包成一个文件，让浏览器更容易加载。
### 3.4.3.2 用 npm 和客户端开发工具做更多事情

前面那个例子很简单，只是为了说明可以通过 npm 使用浏览器端的库。Web 开发人员一般会下载 Bootstrap 的文件，然后手动添加到项目中。那些制作简单的静态站的 Web 设计师通常都是这么做的。
但时髦的前端开发人员不仅用 npm 下载这些库，还会用 npm 在客户端 JavaScript 中加载它们。借助 Browserify 和 Webpack，可以释放出 npm 安装器和加载依赖项的 require 的全部力量。想象一下，不仅在写 Node 代码时，在做前端开发时也可以嵌入 const React = require('react') 这样的代码，这超出了本章的范围，不过你应该感受到了吧，把源自 Node 的编程技术跟前端开发结合起来将释放出多么大的能量。

  
















































































