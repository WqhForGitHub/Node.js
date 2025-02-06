# koa
app.js
```javascript
const Koa = require("koa");
const bodyParser = require('koa-bodyparser');

const app = new Koa();

// 全局错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;

    ctx.body = {
      status: ctx.status,
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
