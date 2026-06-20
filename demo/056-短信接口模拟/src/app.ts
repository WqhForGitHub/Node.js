import express, { Request, Response } from 'express';

/**
 * 短信接口模拟
 * Express + TypeScript 业务系统示例
 */
interface Sms {
  id: number;
  phone: string;
  code: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const items: Sms[] = [
  {
    id: 1,
    phone: '13800138000',
    code: '123456',
    status: 'sent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Sms,
];
let nextId = 2;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '短信接口模拟' });
});

// 列表（支持分页）
app.get('/api/smss', (req: Request, res: Response) => {
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
app.get('/api/smss/:id', (req: Request, res: Response) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    res.status(404).json({ message: '未找到资源' });
    return;
  }
  res.json(item);
});

// 创建
app.post('/api/smss', (req: Request, res: Response) => {
  const item = {
    id: nextId++,
    phone: req.body.phone,
    code: req.body.code,
    status: req.body.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Sms;
  items.push(item);
  res.status(201).json(item);
});

// 更新
app.put('/api/smss/:id', (req: Request, res: Response) => {
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
  } as Sms;
  res.json(items[idx]);
});

// 删除
app.delete('/api/smss/:id', (req: Request, res: Response) => {
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
  console.log('[短信接口模拟] running at http://localhost:' + PORT);
});
