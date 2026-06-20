import express, { Request, Response } from 'express';

/**
 * 极简主义后端
 * Express + TypeScript 基础示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '极简主义后端' });
});

app.get('/api', (_req, res) => {
  res.json({ message: '极简API', path: '/api' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[极简主义后端] running at http://localhost:' + PORT);
});
