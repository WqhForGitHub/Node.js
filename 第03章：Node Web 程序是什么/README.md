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





















