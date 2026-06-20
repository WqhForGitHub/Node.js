import express, { Request, Response, Router } from 'express';

/**
 * 微服务基础模板
 * Express + TypeScript 模块化路由示例
 */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 用户路由
const userRouter: Router = Router();
userRouter.get('/', (_req: Request, res: Response) => {
  res.json([
    { id: 1, name: 'admin' },
    { id: 2, name: 'user' },
  ]);
});
userRouter.get('/:id', (req: Request, res: Response) => {
  res.json({ id: Number(req.params.id), name: 'user-' + req.params.id });
});
userRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json({ id: Date.now(), ...req.body });
});

// 文章路由
const postRouter: Router = Router();
postRouter.get('/', (_req: Request, res: Response) => {
  res.json([{ id: 1, title: 'Hello Express' }]);
});
postRouter.get('/:id', (req: Request, res: Response) => {
  res.json({ id: Number(req.params.id), title: 'Post ' + req.params.id });
});
postRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json({ id: Date.now(), ...req.body });
});

// 评论路由
const commentRouter: Router = Router();
commentRouter.get('/', (_req: Request, res: Response) => {
  res.json([{ id: 1, content: 'Nice post!' }]);
});
commentRouter.post('/', (req: Request, res: Response) => {
  res.status(201).json({ id: Date.now(), ...req.body });
});

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '微服务基础模板' });
});

// 挂载路由
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/comments', commentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[微服务基础模板] running at http://localhost:' + PORT);
});
