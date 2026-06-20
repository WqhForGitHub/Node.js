import express, { Request, Response } from 'express';

/**
 * 基础用户API
 * Express + TypeScript CRUD 示例
 */
interface User {
  id: number;
  username: string;
  email: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let items: User[] = [
  { id: 1, username: 'user1', email: 'user1@test.com' } as User,
  { id: 2, username: 'user1-2', email: 'user1@test.com-2' } as User,
];
let nextId = 3;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '基础用户API' });
});

// 列表
app.get('/api/users', (_req: Request, res: Response) => {
  res.json(items);
});

// 详情
app.get('/api/users/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/users', (req: Request, res: Response) => {
  const item = { id: nextId++, ...req.body } as User;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/users/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: 'not found' });
    return;
  }
  items[idx] = { ...items[idx], ...req.body } as User;
  res.json(items[idx]);
});

// 删除
app.delete('/api/users/:id', (req: Request, res: Response) => {
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
  console.log('[基础用户API] running at http://localhost:' + PORT);
});
