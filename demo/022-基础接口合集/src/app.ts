import express, { Request, Response } from 'express';

/**
 * 基础接口合集
 * Express + TypeScript 基础示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '基础接口合集' });
});

app.get('/api/status', (_req, res) => {
  res.json({ message: '状态', path: '/api/status' });
});

app.get('/api/version', (_req, res) => {
  res.json({ message: '版本', path: '/api/version' });
});

app.get('/api/time', (_req, res) => {
  res.json({ message: '时间', path: '/api/time' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[基础接口合集] running at http://localhost:' + PORT);
});
