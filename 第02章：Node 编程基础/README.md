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






















