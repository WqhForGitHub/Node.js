import express, { Request, Response } from 'express';

/**
 * API网关集群
 * API网关集群
 * Express + TypeScript 示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'API网关集群' });
});

app.get('/api/info', (_req: Request, res: Response) => {
  res.json({
    name: 'API网关集群',
    description: 'API网关集群',
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
  console.log('[API网关集群] running at http://localhost:' + PORT);
});
