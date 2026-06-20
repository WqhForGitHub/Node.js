import express, { Request, Response, NextFunction } from 'express';

/**
 * 业务中台API
 * Express + TypeScript 分层架构示例
 * 分层: routes -> controller -> service -> repository
 */

interface Business {
  name: string;
  code: string;
  id: number;
}

// ---- Repository 层 ----
class BusinessRepository {
  private items: Business[] = [{ id: 1, name: 'sample', code: 'sample' } as Business];
  findAll(): Business[] {
    return this.items;
  }
  findById(id: number): Business | undefined {
    return this.items.find((i) => i.id === id);
  }
  create(data: Partial<Business>): Business {
    const item = { id: Date.now(), ...data } as Business;
    this.items.push(item);
    return item;
  }
  update(id: number, data: Partial<Business>): Business | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...data } as Business;
    return this.items[idx];
  }
  delete(id: number): Business | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }
}

// ---- Service 层 ----
class BusinessService {
  constructor(private repo: BusinessRepository) {}
  list(): Business[] {
    return this.repo.findAll();
  }
  get(id: number): Business | undefined {
    return this.repo.findById(id);
  }
  create(data: Partial<Business>): Business {
    if (!data) throw new Error('数据不能为空');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Business>): Business {
    const item = this.repo.update(id, data);
    if (!item) throw new Error('未找到资源');
    return item;
  }
  delete(id: number): Business {
    const item = this.repo.delete(id);
    if (!item) throw new Error('未找到资源');
    return item;
  }
}

// ---- Controller 层 ----
class BusinessController {
  constructor(private service: BusinessService) {}
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

const repo = new BusinessRepository();
const service = new BusinessService(repo);
const controller = new BusinessController(service);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '业务中台API' });
});
app.get('/api/businesss', controller.list.bind(controller));
app.get('/api/businesss/:id', controller.get.bind(controller));
app.post('/api/businesss', controller.create.bind(controller));
app.put('/api/businesss/:id', controller.update.bind(controller));
app.delete('/api/businesss/:id', controller.delete.bind(controller));

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[业务中台API] running at http://localhost:' + PORT);
});
