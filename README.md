# koa
app.js
```javascript
const Koa = require("koa");
const bodyParser = require('koa-bodyparser');

const app = new Koa();

// 全局错误处理中间件
app.use(async (ctx, next) => {

  ctx.resData = data => {
    ctx.response.body = {
      statusCode: 200,
      code: 0,
      status: 'success',
      data
    }
  }

  try {
    await next();
  } catch (err) {
    ctx.response.body = {
      statusCode: 500,
      status: 'fail',
      code: 1,
      message: err.message
    }
  }
});

app.on('error', (err, ctx) => {
  console.error('server error', err, ctx);
});

// 解析请求主体
app.use(bodyParser());

app.listen(3000);
```
