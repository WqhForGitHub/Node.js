import express, { Request, Response } from 'express';

/**
 * 基础服务框架
 * Express + TypeScript CRUD 示例
 */
interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const items: Todo[] = [
  { id: 1, title: 'todo-1', done: false } as Todo,
  { id: 2, title: 'todo-1-2', done: false } as Todo,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '基础服务框架' });
});

// 列表
app.get('/api/todos', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/todos/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/todos', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Todo;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/todos/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Todo;
  res.json(items[idx]);
});

// 删除
app.delete('/api/todos/:id', (req: Request, res: Response) => {
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
  console.log('[基础服务框架] running at http://localhost:' + PORT);
});
