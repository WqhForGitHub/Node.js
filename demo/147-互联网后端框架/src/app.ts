import express, { Request, Response, NextFunction } from 'express';

/**
 * 互联网后端框架
 * Express + TypeScript 分层架构示例
 * 分层: routes -> controller -> service -> repository
 */

interface Service {
  name: string;
  version: string;
  id: number;
}

// ---- Repository 层 ----
class ServiceRepository {
  private items: Service[] = [{ id: 1, name: 'sample', version: 'sample' } as Service];
  findAll(): Service[] {
    return this.items;
  }
  findById(id: number): Service | undefined {
    return this.items.find((i) => i.id === id);
  }
  create(data: Partial<Service>): Service {
    const item = { id: Date.now(), ...data } as Service;
    this.items.push(item);
    return item;
  }
  update(id: number, data: Partial<Service>): Service | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...data } as Service;
    return this.items[idx];
  }
  delete(id: number): Service | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }
}

// ---- Service 层 ----
class ServiceService {
  constructor(private repo: ServiceRepository) {}
  list(): Service[] {
    return this.repo.findAll();
  }
  get(id: number): Service | undefined {
    return this.repo.findById(id);
  }
  create(data: Partial<Service>): Service {
    if (!data) throw new Error('数据不能为空');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Service>): Service {
    const item = this.repo.update(id, data);
    if (!item) throw new Error('未找到资源');
    return item;
  }
  delete(id: number): Service {
    const item = this.repo.delete(id);
    if (!item) throw new Error('未找到资源');
    return item;
  }
}

// ---- Controller 层 ----
class ServiceController {
  constructor(private service: ServiceService) {}
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

const repo = new ServiceRepository();
const service = new ServiceService(repo);
const controller = new ServiceController(service);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '互联网后端框架' });
});
app.get('/api/services', controller.list.bind(controller));
app.get('/api/services/:id', controller.get.bind(controller));
app.post('/api/services', controller.create.bind(controller));
app.put('/api/services/:id', controller.update.bind(controller));
app.delete('/api/services/:id', controller.delete.bind(controller));

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[互联网后端框架] running at http://localhost:' + PORT);
});
