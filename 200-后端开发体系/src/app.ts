import express, { Request, Response, NextFunction } from 'express';

/**
 * 后端开发体系
 * Express + TypeScript 分层架构示例
 * 分层: routes -> controller -> service -> repository
 */

interface Module {
  name: string;
  type: string;
  status: string;
  id: number;
}

// ---- Repository 层 ----
class ModuleRepository {
  private items: Module[] = [{ id: 1, name: 'sample', type: 'sample', status: 'sample' } as Module];
  findAll(): Module[] {
    return this.items;
  }
  findById(id: number): Module | undefined {
    return this.items.find((i) => i.id === id);
  }
  create(data: Partial<Module>): Module {
    const item = { id: Date.now(), ...data } as Module;
    this.items.push(item);
    return item;
  }
  update(id: number, data: Partial<Module>): Module | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...data } as Module;
    return this.items[idx];
  }
  delete(id: number): Module | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }
}

// ---- Service 层 ----
class ModuleService {
  constructor(private repo: ModuleRepository) {}
  list(): Module[] {
    return this.repo.findAll();
  }
  get(id: number): Module | undefined {
    return this.repo.findById(id);
  }
  create(data: Partial<Module>): Module {
    if (!data) throw new Error('数据不能为空');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Module>): Module {
    const item = this.repo.update(id, data);
    if (!item) throw new Error('未找到资源');
    return item;
  }
  delete(id: number): Module {
    const item = this.repo.delete(id);
    if (!item) throw new Error('未找到资源');
    return item;
  }
}

// ---- Controller 层 ----
class ModuleController {
  constructor(private service: ModuleService) {}
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

const repo = new ModuleRepository();
const service = new ModuleService(repo);
const controller = new ModuleController(service);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '后端开发体系' });
});
app.get('/api/modules', controller.list.bind(controller));
app.get('/api/modules/:id', controller.get.bind(controller));
app.post('/api/modules', controller.create.bind(controller));
app.put('/api/modules/:id', controller.update.bind(controller));
app.delete('/api/modules/:id', controller.delete.bind(controller));

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[后端开发体系] running at http://localhost:' + PORT);
});
