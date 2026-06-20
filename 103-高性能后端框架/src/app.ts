import express, { Request, Response } from 'express';

/**
 * 高性能后端框架
 * Express + TypeScript 缓存示例（内存缓存模拟）
 */
interface CacheItem<T> {
  value: T;
  expireAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheItem<any>>();
  set(key: string, value: any, ttl: number = 60000): void {
    this.store.set(key, { value, expireAt: Date.now() + ttl });
  }
  get<T>(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expireAt) {
      this.store.delete(key);
      return undefined;
    }
    return item.value as T;
  }
  delete(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  size(): number {
    return this.store.size;
  }
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

const app = express();
app.use(express.json());

const cache = new MemoryCache();

// 模拟数据库
const db: Record<string, any> = {
  'user:1': { id: 1, name: '张三', email: 'zhangsan@example.com' },
  'user:2': { id: 2, name: '李四', email: 'lisi@example.com' },
};

function queryFromDb(key: string): any {
  // 模拟数据库查询延迟
  return db[key];
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: '高性能后端框架',
    cacheSize: cache.size(),
  });
});

// 带缓存的查询
app.get('/api/users/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const cacheKey = 'user:' + id;
  let data = cache.get(cacheKey);
  if (data) {
    res.json({ data, from: 'cache' });
    return;
  }
  data = queryFromDb(cacheKey);
  if (!data) {
    res.status(404).json({ message: '用户不存在' });
    return;
  }
  cache.set(cacheKey, data, 30000); // 30秒过期
  res.json({ data, from: 'db' });
});

// 清除缓存
app.delete('/api/cache/:key', (req: Request, res: Response) => {
  cache.delete(req.params.key);
  res.json({ message: '缓存已清除', key: req.params.key });
});

app.delete('/api/cache', (_req: Request, res: Response) => {
  cache.clear();
  res.json({ message: '所有缓存已清除' });
});

// 查看缓存键
app.get('/api/cache', (_req: Request, res: Response) => {
  res.json({ keys: cache.keys(), size: cache.size() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[高性能后端框架] running at http://localhost:' + PORT);
});
