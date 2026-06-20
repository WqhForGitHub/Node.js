import express, { Request, Response } from 'express';

/**
 * 入门级REST服务
 * Express + TypeScript CRUD 示例
 */
interface Article {
  id: number;
  title: string;
  content: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: Article[] = [
  { id: 1, title: 'article-1', content: 'hello' } as Article,
  { id: 2, title: 'article-1-2', content: 'hello-2' } as Article,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '入门级REST服务' });
});

// 列表
app.get('/api/articles', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/articles/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/articles', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Article;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/articles/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Article;
  res.json(items[idx]);
});

// 删除
app.delete('/api/articles/:id', (req: Request, res: Response) => {
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
  console.log('[入门级REST服务] running at http://localhost:' + PORT);
});
