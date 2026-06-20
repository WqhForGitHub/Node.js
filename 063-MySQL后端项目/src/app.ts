import express, { Request, Response } from 'express';

/**
 * MySQL后端项目
 * Express + TypeScript CRUD 示例
 */
interface Record {
  id: number;
  name: string;
  value: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: Record[] = [
  { id: 1, name: 'record-1', value: 'value-1' } as Record,
  { id: 2, name: 'record-1-2', value: 'value-1-2' } as Record,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'MySQL后端项目' });
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
  console.log('[MySQL后端项目] running at http://localhost:' + PORT);
});
