import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 接口开发示例
 * Koa + TypeScript 基础示例
 * RESTful CRUD for "items"
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

let items: any[] = [
  { id: 1, name: 'items-demo-1' },
  { id: 2, name: 'items-demo-2' },
];
let nextId = 3;

router.get('/items', (ctx) => {
  ctx.body = items;
});
router.get('/items/:id', (ctx) => {
  const item = items.find((i) => i.id === Number(ctx.params.id));
  if (!item) {
    ctx.status = 404;
    ctx.body = { message: 'not found' };
    return;
  }
  ctx.body = item;
});
router.post('/items', (ctx) => {
  const item = { id: nextId++, ...(ctx.request.body || {}) };
  items.push(item);
  ctx.status = 201;
  ctx.body = item;
});
router.put('/items/:id', (ctx) => {
  const idx = items.findIndex((i) => i.id === Number(ctx.params.id));
  if (idx < 0) {
    ctx.status = 404;
    ctx.body = { message: 'not found' };
    return;
  }
  items[idx] = { ...items[idx], ...(ctx.request.body || {}) };
  ctx.body = items[idx];
});
router.delete('/items/:id', (ctx) => {
  const idx = items.findIndex((i) => i.id === Number(ctx.params.id));
  if (idx < 0) {
    ctx.status = 404;
    ctx.body = { message: 'not found' };
    return;
  }
  const [removed] = items.splice(idx, 1);
  ctx.body = removed;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[接口开发示例] running'));
