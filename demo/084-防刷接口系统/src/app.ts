import express, { Request, Response, NextFunction } from 'express';

/**
 * 防刷接口系统
 * Express + TypeScript 限流示例
 */
const app = express();
app.use(express.json());

// 限流器
class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private max: number,
    private windowMs: number
  ) {}

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let record = this.hits.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, record);
    }
    record.count++;
    return {
      allowed: record.count <= this.max,
      remaining: Math.max(0, this.max - record.count),
      resetAt: record.resetAt,
    };
  }
}

const limiter = new RateLimiter(10, 60000); // 每分钟10次

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const result = limiter.check(ip);
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
  if (!result.allowed) {
    res.status(429).json({ message: '请求过于频繁，请稍后再试' });
    return;
  }
  next();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '防刷接口系统' });
});

app.use('/api', rateLimitMiddleware);

app.get('/api/data', (_req: Request, res: Response) => {
  res.json({ message: '请求成功', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[防刷接口系统] running at http://localhost:' + PORT);
});
