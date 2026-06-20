import express, { Request, Response } from 'express';

/**
 * 通知推送服务
 * Express + TypeScript 业务系统示例
 */
interface Notification {
  id: number;
  userId: number;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const items: Notification[] = [
  {
    id: 1,
    userId: 1,
    title: '通知',
    content: '内容',
    read: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Notification,
];
let nextId = 2;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '通知推送服务' });
});

// 列表（支持分页）
app.get('/api/notifications', (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const size = Number(req.query.size) || 10;
  const start = (page - 1) * size;
  const list = items.slice(start, start + size);
  res.json({
    list,
    total: items.length,
    page,
    size,
  });
});

// 详情
app.get('/api/notifications/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/notifications', (req: Request, res: Response) => {
  const item = {
    id: nextId++,
    userId: req.body.userId,
    title: req.body.title,
    content: req.body.content,
    read: req.body.read,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Notification;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/notifications/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  items[idx] = {
    ...items[idx],
    ...req.body,
    id: items[idx].id,
    updatedAt: new Date().toISOString(),
  } as Notification;
  res.json(items[idx]);
});

// 删除
app.delete('/api/notifications/:id', (req: Request, res: Response) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx < 0) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  const [removed] = items.splice(idx, 1);
  res.json(removed);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[通知推送服务] running at http://localhost:' + PORT);
});
