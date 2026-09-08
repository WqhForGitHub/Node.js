import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * ORM集成服务
 * 装饰器风格 ORM
 * 模拟 ORM: 装饰器风格的模型定义 + 查询构造器
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// 模型元数据
function Entity(opts: { table: string }) {
  return <T extends new (...a: any[]) => {}>(c: T) => {
    (c as any)._meta = { table: opts.table };
    return c;
  };
}
function Column() {
  return (t: any, k: string) => {
    t.constructor._columns = t.constructor._columns || [];
    t.constructor._columns.push(k);
  };
}

@Entity({ table: 'products' })
class Product {
  @Column() id!: number;
  @Column() name!: string;
  @Column() price!: number;
}

// 内存表
const table: any[] = [
  { id: 1, name: '笔记本', price: 5999 },
  { id: 2, name: '鼠标', price: 99 },
];

class QueryBuilder<T extends { id: number }> {
  constructor(private rows: any[]) {}
  where(field: string, op: '=' | '>', value: any) {
    this.rows = this.rows.filter((r) => (op === '=' ? r[field] === value : r[field] > value));
    return this;
  }
  limit(n: number) {
    return this.rows.slice(0, n);
  }
  all() {
    return this.rows;
  }
}

function repo<T extends { id: number }>(rows: any[]) {
  return new QueryBuilder<T>([...rows]);
}

router.get('/products', (ctx) => {
  const q = repo<Product>(table);
  if (ctx.query.minPrice) q.where('price', '>', Number(ctx.query.minPrice));
  ctx.body = q.all();
});
router.post('/products', (ctx) => {
  const p = { id: table.length + 1, ...(ctx.request.body || {}) };
  table.push(p);
  ctx.status = 201;
  ctx.body = p;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[ORM集成服务] running'));
