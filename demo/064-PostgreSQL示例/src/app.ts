import express, { Request, Response } from 'express';

/**
 * PostgreSQL示例
 * Express + TypeScript CRUD 示例
 */
interface Record {
  id: number;
  name: string;
  data: any;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const items: Record[] = [
  { id: 1, name: 'pg-record', data: null } as Record,
  { id: 2, name: 'pg-record-2', data: null } as Record,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'PostgreSQL示例' });
});

// 列表
app.get('/api/records', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/records/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/records', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Record;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/records/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Record;
  res.json(items[idx]);
});

// 删除
app.delete('/api/records/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  const [removed] = items.splice(idx, 1);
  res.json(removed);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[PostgreSQL示例] running at http://localhost:' + PORT);
});
