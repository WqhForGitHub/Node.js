import express, { Request, Response } from 'express';

/**
 * 代码训练营
 * Express + TypeScript 基础示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '代码训练营' });
});

app.get('/api/hello', (_req, res) => {
  res.json({ message: '示例接口', path: '/api/hello' });
});

app.get('/api/list', (_req, res) => {
  res.json({ message: '列表接口', path: '/api/list' });
});

app.post('/api/create', (req, res) => {
  res.json({ message: '创建接口', path: '/api/create', body: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[代码训练营] running at http://localhost:' + PORT);
});
