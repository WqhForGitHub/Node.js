import express, { Request, Response } from 'express';

/**
 * 后端能力训练
 * Express + TypeScript CRUD 示例
 */
interface Task {
  id: number;
  title: string;
  done: boolean;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: Task[] = [
  { id: 1, title: 'task', done: false } as Task,
  { id: 2, title: 'task-2', done: false } as Task,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '后端能力训练' });
});

// 列表
app.get('/api/tasks', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/tasks', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as Task;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/tasks/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as Task;
  res.json(items[idx]);
});

// 删除
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
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
  console.log('[后端能力训练] running at http://localhost:' + PORT);
});
