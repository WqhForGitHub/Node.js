import express, { Request, Response } from 'express';

/**
 * 实战演练项目
 * Express + TypeScript CRUD 示例
 */
interface Item {
  id: number;
  name: string;
  status: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: Item[] = [
  { id: 1, name: 'item', status: 'active' } as Item,
  { id: 2, name: 'item-2', status: 'active-2' } as Item,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '实战演练项目' });
});

// 列表
app.get('/api/items', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/items/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/items', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Item;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/items/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Item;
  res.json(items[idx]);
});

// 删除
app.delete('/api/items/:id', (req: Request, res: Response) => {
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
  console.log('[实战演练项目] running at http://localhost:' + PORT);
});
