import express, { Request, Response } from 'express';

/**
 * 后端生成器
 * 代码生成
 * Express + TypeScript 示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '后端生成器' });
});

app.get('/api/info', (_req: Request, res: Response) => {
  res.json({
    name: '后端生成器',
    description: '代码生成',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/data', (_req: Request, res: Response) => {
  res.json({
    items: [
      { id: 1, name: 'item-1' },
      { id: 2, name: 'item-2' },
    ],
    total: 2,
  });
});

app.post('/api/data', (req: Request, res: Response) => {
  const { name } = req.body || {};
  if (!name) {
    res.status(400).json({ message: '缺少 name' });
    return;
  }
  res.status(201).json({ id: Date.now(), name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[后端生成器] running at http://localhost:' + PORT);
});
