import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * Redis缓存系统
 * 内存模拟 Redis，实现 MemoryCache 类（get/set/del/expire/incr/keys），带 TTL 过期
 */

// ---- 内存缓存类 ----
interface CacheEntry {
  value: any;
  expireAt?: number; // 过期时间戳，undefined 表示永久
}

class MemoryCache {
  private store: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;

  // 检查并清理过期
  private isExpired(entry: CacheEntry): boolean {
    return entry.expireAt !== undefined && Date.now() >= entry.expireAt;
  }

  // 清理过期 key（惰性）
  private clean(key: string): void {
    const entry = this.store.get(key);
    if (entry && this.isExpired(entry)) {
      this.store.delete(key);
    }
  }

  get(key: string): any {
    this.clean(key);
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    this.hits++;
    return entry.value;
  }

  set(key: string, value: any, ttlSec?: number): void {
    const entry: CacheEntry = { value };
    if (ttlSec !== undefined && ttlSec > 0) {
      entry.expireAt = Date.now() + ttlSec * 1000;
    }
    this.store.set(key, entry);
  }

  del(key: string): boolean {
    return this.store.delete(key);
  }

  // 设置已存在 key 的过期
  expire(key: string, ttlSec: number): boolean {
    this.clean(key);
    const entry = this.store.get(key);
    if (!entry) return false;
    entry.expireAt = Date.now() + ttlSec * 1000;
    return true;
  }

  // 数值自增
  incr(key: string): number {
    this.clean(key);
    const entry = this.store.get(key);
    if (!entry) {
      this.set(key, 1);
      return 1;
    }
    const n = Number(entry.value);
    if (Number.isNaN(n)) throw { status: 400, message: 'value is not an integer' };
    entry.value = n + 1;
    return entry.value;
  }

  // 按通配符匹配 key（简单实现，支持 * 通配）
  keys(pattern: string): string[] {
    const allKeys = Array.from(this.store.keys()).filter((k) => {
      this.clean(k);
      return this.store.has(k);
    });
    if (!pattern) return allKeys;
    // 转换 glob 到正则
    const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return allKeys.filter((k) => regex.test(k));
  }

  size(): number {
    // 清理一遍
    for (const k of Array.from(this.store.keys())) this.clean(k);
    return this.store.size;
  }

  stats(): { keys: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      keys: this.size(),
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(4)),
    };
  }
}

// ---- Service 层 ----
class CacheService {
  constructor(private cache: MemoryCache) {}

  get(key: string): any {
    return this.cache.get(key);
  }

  set(data: any): void {
    if (!data.key) throw { status: 400, message: 'key required' };
    this.cache.set(data.key, data.value, data.ttl);
  }

  del(key: string): boolean {
    return this.cache.del(key);
  }

  incr(key: string): number {
    return this.cache.incr(key);
  }

  keys(pattern: string): string[] {
    return this.cache.keys(pattern || '');
  }

  stats(): any {
    return this.cache.stats();
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new CacheService(new MemoryCache());

// GET /api/cache/stats - 统计（需在 :key 之前）
router.get('/api/cache/stats', (ctx) => {
  ctx.body = service.stats();
});

// GET /api/cache/keys - 按 glob 匹配
router.get('/api/cache/keys', (ctx) => {
  const pattern = (ctx.query as any).pattern || '*';
  ctx.body = service.keys(pattern);
});

// POST /api/cache - 设置键值（带 ttl）
router.post('/api/cache', (ctx) => {
  try {
    service.set(ctx.request.body as any || {});
    ctx.body = { ok: true };
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// DELETE /api/cache/:key - 删除
router.delete('/api/cache/:key', (ctx) => {
  ctx.body = { deleted: service.del(ctx.params.key) };
});

// POST /api/cache/:key/incr - 自增
router.post('/api/cache/:key/incr', (ctx) => {
  try {
    ctx.body = { value: service.incr(ctx.params.key) };
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/cache/:key - 取值
router.get('/api/cache/:key', (ctx) => {
  const value = service.get(ctx.params.key);
  if (value === null) { ctx.status = 404; ctx.body = { message: 'key not found' }; return; }
  ctx.body = { key: ctx.params.key, value };
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[Redis缓存系统] running at http://localhost:' + PORT);
});
