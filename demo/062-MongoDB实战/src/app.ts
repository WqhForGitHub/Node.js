import express, { Request, Response } from 'express';

/**
 * MongoDB实战
 * Express + TypeScript CRUD 示例
 */
interface Document {
  id: number;
  title: string;
  data: any;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: Document[] = [
  { id: 1, title: 'doc-1', data: null } as Document,
  { id: 2, title: 'doc-1-2', data: null } as Document,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'MongoDB实战' });
});

// 列表
app.get('/api/documents', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/documents/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/documents', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Document;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/documents/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Document;
  res.json(items[idx]);
});

// 删除
app.delete('/api/documents/:id', (req: Request, res: Response) => {
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
  console.log('[MongoDB实战] running at http://localhost:' + PORT);
});
