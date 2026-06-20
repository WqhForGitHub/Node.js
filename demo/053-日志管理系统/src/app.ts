import express, { Request, Response } from 'express';

/**
 * 日志管理系统
 * Express + TypeScript 业务系统示例
 */
interface Log {
  id: number;
  level: string;
  message: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const items: Log[] = [
  {
    id: 1,
    level: 'info',
    message: '系统启动',
    source: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Log,
];
let nextId = 2;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '日志管理系统' });
});

// 列表（支持分页）
app.get('/api/logs', (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const size = Number(req.query.size) || 10;
  const start = (page - 1) * size;
  const list = items.slice(start, start + size);
  res.json({
    list,
    total: items.length,
    page,
    size,
  });
});

// 详情
app.get('/api/logs/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/logs', (req: Request, res: Response) => {
  const item = {
    id: nextId++,
    level: req.body.level,
    message: req.body.message,
    source: req.body.source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Log;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/logs/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  items[idx] = {
    ...items[idx],
    ...req.body,
    id: items[idx].id,
    updatedAt: new Date().toISOString(),
  } as Log;
  res.json(items[idx]);
});

// 删除
app.delete('/api/logs/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  const [removed] = items.splice(idx, 1);
  res.json(removed);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[日志管理系统] running at http://localhost:' + PORT);
});
