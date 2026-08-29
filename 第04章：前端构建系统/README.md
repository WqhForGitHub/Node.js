# 4.2 用 npm 运行脚本

Node 有 npm，而 npm 能运行脚本。因此，合作者或用户要能够调用 npm start 和 npm test 之类的命令。在项目的 package.json 文件中，有个 scripts 属性，可以在那里指定自己的 npm start 命令：
```json
{
	"scripts": {
		"start": "node server.js"
	}
}
```
node server.js 是默认的 start 命令，所以如果只是要做这个，从技术角度讲上面的定义是可以省略的。当然，别忘了创建 server.js 文件。我们一般都会定义 test 属性，因为可以把测试框架作为依赖项，然后用 npm test 来运行测试脚本。比如说，你选了 Mocha 来做测试，并且已经用 npm install --save-dev 装好了。如果在 package.json 中添加下面的语句，就不用全局安装 Mocha 了：
```json
{
	"scripts": {
		"test": "./node_modules/.bin/mocha test/*.js"
	}
}
```
注意看一下，这个例子里的参数是传给了 Mocha。也可以在运行 npm 脚本时用两个连字符传入参数：
```shell
npm test -- test/*.js
```
表 4-1 给出了一些常用的 npm 命令：

| 命令                  | package.json 属性                      | 应用案例                                                       |
| ------------------- | ------------------------------------ | ---------------------------------------------------------- |
| start               | scripts.start                        | 启动 Web 应用服务器或 Electron 程序                                  |
| stop                | scripts.stop                         | 停掉 Web 应用服务器                                               |
| restart             |                                      | 运行 stop，然后运行 start                                         |
| Install，postinstall | scripts.install, scripts.postinstall | 在安装了包之后运行本地构建命令。注意，postinstall 只能通过 npm run postinstall 运行 |
还有很多可用的命令，包括在发布包之前进行清理的命令，以及用于包版本迁移时的前置/后置命令。但对于大多数 Web 开发任务来说，start 和 test 就够用了。
使用 npm 时，可能会有很多你想要定义的任务并没有恰当的命令名支持。比如说，你正在处理一个用 ES2015 写的项目，但是你想要把它转译成 ES5，这时可以用 npm run。下一节会有个教程教你如何创建一个能够构建 ES2015 文件的新项目。
## 4.2.1 创建定制的 npm 脚本

npm run 命令等同于 npm run-script，用 npm run script-name 可以运行任何脚本。我们来看一下如何做一个用 Babel 构建客户端脚本的命令。
从创建新项目开始，然后安装必要的依赖项：
```shell
mkdir es2015-example
cd es2015-example
npm init -y
npm install --save-dev babel-cli babel-preset-es2015
echo '{ "presets": ["es2015"] }' > .babelrc
```
现在你应该有了一个具有基本 Babel ES2015 工具和插件的 Node 项目。接下来打开 package.json，在 scripts 下面添加 babel 属性。
它应该运行已经安装到 node_modules/.bin 文件夹下的脚本：
```javascript
"babel": "./node_modules/.bin/babel browser.js -d build/"
```
下面是用 ES2015 语法写的代码，将它存为 browser.js 文件：
```javascript
class Example {
	render() {
		return `<h1>Example</h1>`
	}
}

const example = new Example();
console.log(example.render());
```
运行 npm run babel 试一下。如果配置都没问题，应该会有一个 build 文件夹，里面有转译过的 browser.js。打开这个文件，看看里面是不是 ES5 的代码。因为太长了，我们就不放到这里来了，文件顶部应该有 var_createClass 这样的代码。
如果构建项目时只需要做这件事情，那么可以将这个任务的名称改为 build。但一般会加上UglifyJS：
```bash
npm i --save-dev uglify-es
```
可以用 node_modules/.bin/uglifyjs 调用 UglifyJS，在 scripts 下添加名为 uglify 的属性：
```shell
./node_modules/.bin/uglifyjs build/browser.js -o build/browser.min.js
```
现在应该可以运行 npm run uglify 命令了。这些命令可以组合到一起。在 scripts 下添加一个名为 build 的属性，让它调用这两个任务：
```shell
"build": "npm run babel && npm run uglify"
```
运行 npm run build 会执行那两个脚本。用这个简单的命令可以组合多个前端打包工具。这是因为 Babel 和 UglifyJS 都可以作为命令行脚本执行，并且都接受命令行参数，所有很容易放到一行里添加到 package.json 中。Babel 支持配置文件，我们可以在 .babelrc 文件中实现更复杂的行为，你应该在之前的命令中见过这个文件了。









