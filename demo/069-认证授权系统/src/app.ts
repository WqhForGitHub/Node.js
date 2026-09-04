import express, { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * 认证授权系统
 * Express + TypeScript 用户系统示例（含 JWT 模拟）
 */
interface User {
  id: number;
  username: string;
  password: string;
  role: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const users: User[] = [{ id: 1, username: 'admin', password: hashPwd('123456'), role: 'admin' }];
let nextId = 2;

function hashPwd(pwd: string): string {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function makeToken(user: User): string {
  // 模拟 JWT (header.payload.signature)
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      ts: Date.now(),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', 'secret').update(payload).digest('hex');
  return 'eyJhbGci.' + payload + '.' + sig;
}

function verifyToken(req: Request): any | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '认证授权系统' });
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
  const user: User = {
    id: nextId++,
    username,
    password: hashPwd(password),
    role: 'user',
  };
  users.push(user);
  res.status(201).json({ id: user.id, username: user.username, role: user.role });
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
    token: makeToken(user),
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// 当前用户
app.get('/api/me', (req: Request, res: Response) => {
  const payload = verifyToken(req);
  if (!payload) {
    res.status(401).json({ message: '未授权' });
    return;
  }
  const user = users.find((u) => u.id === payload.id);
  if (!user) {
    res.status(404).json({ message: '用户不存在' });
    return;
  }
  res.json({ id: user.id, username: user.username, role: user.role });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[认证授权系统] running at http://localhost:' + PORT);
});
