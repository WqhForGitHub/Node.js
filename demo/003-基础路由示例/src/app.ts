import express, { Request, Response } from 'express';

/**
 * 基础路由示例
 * Express + TypeScript 基础示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '基础路由示例' });
});

app.get('/api/users', (_req, res) => {
  res.json({ message: '用户列表', path: '/api/users' });
});

app.get('/api/users/:id', (_req, res) => {
  res.json({ message: '用户详情', path: '/api/users/:id' });
});

app.post('/api/users', (req, res) => {
  res.json({ message: '创建用户', path: '/api/users', body: req.body });
});

app.put('/api/users/:id', (req, res) => {
  res.json({ message: '更新用户', path: '/api/users/:id', body: req.body });
});

app.delete('/api/users/:id', (req, res) => {
  res.json({ message: '删除用户', path: '/api/users/:id', body: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[基础路由示例] running at http://localhost:' + PORT);
});
