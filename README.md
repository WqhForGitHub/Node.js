# 文件操作



## 使用 node.js 读取文件

```javascript
const fs = require("fs");

fs.readFile("/users/joe/test.txt", "utf-8", (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    
    console.log(data);
});
```





**`另外，你可以使用同步版本 fs.readFileSync()：`**

```javascript
const fs = require("fs");

try {
    const data = fs.readFileSync("/users/joe/test.txt", "utf-8");
	console.log(data);
} catch (err) {
    console.error(err);
}
```





## 使用 node.js 编写文件

### 编写文件

```javascript
const fs = require('node:fs');

const content = 'Some content!';

fs.writeFile('/Users/joe/test.txt', content, err => {
  if (err) {
    console.error(err);
  } else {
    // file written successfully
  }
});

```



### 同步编写文件

```javascript
const fs = require('node:fs');

const content = 'Some content!';

try {
  fs.writeFileSync('/Users/joe/test.txt', content);
  // file written successfully
} catch (err) {
  console.error(err);
}
```

