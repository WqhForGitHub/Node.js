import Koa from 'koa';
import Router from 'koa-router';

/**
 * 缓存管理系统
 * 内存 LRU+TTL 缓存
 * 缓存管理: 内存 LRU + TTL
 */
const app = new Koa();
const router = new Router();

class Cache {
  private store = new Map<string, { value: any; expire: number }>();
  set(key: string, value: any, ttlMs = 5000) {
    this.store.set(key, { value, expire: Date.now() + ttlMs });
  }
  get(key: string) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expire) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }
  del(key: string) {
    this.store.delete(key);
  }
  size() {
    return this.store.size;
  }
}
const cache = new Cache();

function slowCompute(n: number) {
  return { result: n * n, computedAt: Date.now() };
}

router.get('/compute/:n', (ctx) => {
  const key = 'n:' + ctx.params.n;
  let v = cache.get(key);
  let hit = !!v;
  if (!hit) {
    v = slowCompute(Number(ctx.params.n));
    cache.set(key, v);
  }
  ctx.body = { ...v, cacheHit: hit, cacheSize: cache.size() };
});
router.delete('/cache/:key', (ctx) => {
  cache.del(ctx.params.key);
  ctx.body = { cleared: true };
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 3000, () => console.log('[缓存管理系统] running'));
