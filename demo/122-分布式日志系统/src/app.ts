import express, { Request, Response } from 'express';

/**
 * 分布式日志系统
 * Express + TypeScript 监控示例
 */
interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
  services: Record<string, { status: string; latency?: number }>;
}

interface Metric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

const app = express();
app.use(express.json());

const startTime = Date.now();
const metrics: Metric[] = [];
let requestCount = 0;
let errorCount = 0;

// 请求计数中间件
app.use((req, _res, next) => {
  requestCount++;
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  const status: HealthStatus = {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'ok', latency: 5 },
      cache: { status: 'ok', latency: 2 },
      queue: { status: 'ok', latency: 1 },
    },
  };
  res.json(status);
});

// 就绪检查
app.get('/ready', (_req: Request, res: Response) => {
  res.json({ ready: true, timestamp: new Date().toISOString() });
});

// 存活检查
app.get('/live', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

// 指标
app.get('/metrics', (_req: Request, res: Response) => {
  res.json({
    requestCount,
    errorCount,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: process.memoryUsage(),
    customMetrics: metrics.slice(-100),
  });
});

// 记录自定义指标
app.post('/api/metrics', (req: Request, res: Response) => {
  const { name, value, labels } = req.body || {};
  if (!name || value === undefined) {
    res.status(400).json({ message: '缺少 name 或 value' });
    return;
  }
  const metric: Metric = {
    name,
    value: Number(value),
    labels: labels || {},
    timestamp: new Date().toISOString(),
  };
  metrics.push(metric);
  res.status(201).json(metric);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[分布式日志系统] running at http://localhost:' + PORT);
});
