import express, { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * 基础用户系统
 * Express + TypeScript 用户系统示例
 */
interface User {
  id: number;
  username: string;
  password: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const users: User[] = [{ id: 1, username: 'admin', password: hashPwd('123456') }];
let nextId = 2;

function hashPwd(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '基础用户系统' });
});

// 注册
app.post('/api/register', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ message: '用户名或密码不能为空' });
    return;
  }
  if (users.find((u) => u.username === username)) {
    res.status(400).json({ message: '用户已存在' });
    return;
  }
  const user: User = { id: nextId++, username, password: hashPwd(password) };
  users.push(user);
  res.status(201).json({ id: user.id, username: user.username });
});

// 登录
app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username);
  if (!user || user.password !== hashPwd(password || '')) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    token: 'token-' + user.id + '-' + Date.now(),
  });
});

// 用户列表
app.get('/api/users', (_req: Request, res: Response) => {
  res.json(users.map((u) => ({ id: u.id, username: u.username })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[基础用户系统] running at http://localhost:' + PORT);
});
