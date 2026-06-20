import express, { Request, Response, NextFunction } from 'express';

/**
 * 企业级接口平台
 * Express + TypeScript 分层架构示例
 * 分层: routes -> controller -> service -> repository
 */

interface Api {
  name: string;
  path: string;
  method: string;
  id: number;
}

// ---- Repository 层 ----
class ApiRepository {
  private items: Api[] = [{ id: 1, name: 'sample', path: 'sample', method: 'sample' } as Api];
  findAll(): Api[] {
    return this.items;
  }
  findById(id: number): Api | undefined {
    return this.items.find((i) => i.id === id);
  }
  create(data: Partial<Api>): Api {
    const item = { id: Date.now(), ...data } as Api;
    this.items.push(item);
    return item;
  }
  update(id: number, data: Partial<Api>): Api | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...data } as Api;
    return this.items[idx];
  }
  delete(id: number): Api | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }
}

// ---- Service 层 ----
class ApiService {
  constructor(private repo: ApiRepository) {}
  list(): Api[] {
    return this.repo.findAll();
  }
  get(id: number): Api | undefined {
    return this.repo.findById(id);
  }
  create(data: Partial<Api>): Api {
    if (!data) throw new Error('数据不能为空');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Api>): Api {
    const item = this.repo.update(id, data);
    if (!item) throw new Error('未找到资源');
    return item;
  }
  delete(id: number): Api {
    const item = this.repo.delete(id);
    if (!item) throw new Error('未找到资源');
    return item;
  }
}

// ---- Controller 层 ----
class ApiController {
  constructor(private service: ApiService) {}
  list(_req: Request, res: Response): void {
    res.json(this.service.list());
  }
  get(req: Request, res: Response): void {
    const item = this.service.get(Number(req.params.id));
    if (!item) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    res.json(item);
  }
  create(req: Request, res: Response): void {
    try {
      res.status(201).json(this.service.create(req.body));
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  }
  update(req: Request, res: Response): void {
    try {
      res.json(this.service.update(Number(req.params.id), req.body));
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  }
  delete(req: Request, res: Response): void {
    try {
      res.json(this.service.delete(Number(req.params.id)));
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  }
}

// ---- 装配与路由 ----
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const repo = new ApiRepository();
const service = new ApiService(repo);
const controller = new ApiController(service);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '企业级接口平台' });
});
app.get('/api/apis', controller.list.bind(controller));
app.get('/api/apis/:id', controller.get.bind(controller));
app.post('/api/apis', controller.create.bind(controller));
app.put('/api/apis/:id', controller.update.bind(controller));
app.delete('/api/apis/:id', controller.delete.bind(controller));

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[企业级接口平台] running at http://localhost:' + PORT);
});
