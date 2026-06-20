import Koa from 'koa';
import Router from 'koa-router';

/**
 * 数据访问层服务
 * Repository 数据访问层
 * 数据访问层: Repository 模式 + 内存存储
 */
const app = new Koa();
const router = new Router();

interface Repository<T> {
  find(filter?: Partial<T>): T[];
  findById(id: number): T | undefined;
  create(data: Omit<T, 'id'>): T;
  update(id: number, data: Partial<T>): T | undefined;
  delete(id: number): boolean;
}

class InMemoryRepo<T extends { id: number }> implements Repository<T> {
  private data: T[] = [];
  private nextId = 1;
  find(filter?: Partial<T>) {
    return filter
      ? this.data.filter((d) => Object.entries(filter).every(([k, v]) => (d as any)[k] === v))
      : this.data;
  }
  findById(id: number) {
    return this.data.find((d) => d.id === id);
  }
  create(data: any) {
    const item = { id: this.nextId++, ...data } as T;
    this.data.push(item);
    return item;
  }
  update(id: number, data: Partial<T>) {
    const i = this.data.findIndex((d) => d.id === id);
    if (i < 0) return;
    this.data[i] = { ...this.data[i], ...data };
    return this.data[i];
  }
  delete(id: number) {
    const i = this.data.findIndex((d) => d.id === id);
    if (i < 0) return false;
    this.data.splice(i, 1);
    return true;
  }
}

interface Task {
  id: number;
  title: string;
  done: boolean;
}
const taskRepo = new InMemoryRepo<Task>();
taskRepo.create({ title: '学习 Koa', done: false });
taskRepo.create({ title: '写 Demo', done: false });

router.get('/tasks', (ctx) => {
  ctx.body = taskRepo.find(
    ctx.query.done !== undefined ? { done: ctx.query.done === 'true' } : undefined,
  );
});
router.get('/tasks/:id', (ctx) => {
  const t = taskRepo.findById(Number(ctx.params.id));
  if (!t) {
    ctx.status = 404;
    ctx.body = { message: 'not found' };
    return;
  }
  ctx.body = t;
});
router.post('/tasks', (ctx) => {
  ctx.status = 201;
  ctx.body = taskRepo.create({ title: (ctx.request.body as any).title, done: false });
});
router.put('/tasks/:id', (ctx) => {
  const t = taskRepo.update(Number(ctx.params.id), ctx.request.body as any);
  if (!t) {
    ctx.status = 404;
    ctx.body = { message: 'not found' };
    return;
  }
  ctx.body = t;
});
router.delete('/tasks/:id', (ctx) => {
  ctx.body = { deleted: taskRepo.delete(Number(ctx.params.id)) };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[数据访问层服务] running'));
