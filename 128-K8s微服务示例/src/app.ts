import express, { Request, Response } from 'express';

/**
 * K8s微服务示例
 * K8s部署
 * Express + TypeScript 示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'K8s微服务示例' });
});

app.get('/api/info', (_req: Request, res: Response) => {
  res.json({
    name: 'K8s微服务示例',
    description: 'K8s部署',
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
  console.log('[K8s微服务示例] running at http://localhost:' + PORT);
});
