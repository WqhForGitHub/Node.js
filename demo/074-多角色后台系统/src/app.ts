import express, { Request, Response, NextFunction } from 'express';

/**
 * 多角色后台系统
 * Express + TypeScript 分层架构示例
 * 分层: routes -> controller -> service -> repository
 */

interface Role {
  name: string;
  code: string;
  level: number;
  id: number;
}

// ---- Repository 层 ----
class RoleRepository {
  private items: Role[] = [{ id: 1, name: 'sample', code: 'sample', level: 1 } as Role];
  findAll(): Role[] {
    return this.items;
  }
  findById(id: number): Role | undefined {
    return this.items.find((i) => i.id === id);
  }
  create(data: Partial<Role>): Role {
    const item = { id: Date.now(), ...data } as Role;
    this.items.push(item);
    return item;
  }
  update(id: number, data: Partial<Role>): Role | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    this.items[idx] = { ...this.items[idx], ...data } as Role;
    return this.items[idx];
  }
  delete(id: number): Role | undefined {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return undefined;
    const [removed] = this.items.splice(idx, 1);
    return removed;
  }
}

// ---- Service 层 ----
class RoleService {
  constructor(private repo: RoleRepository) {}
  list(): Role[] {
    return this.repo.findAll();
  }
  get(id: number): Role | undefined {
    return this.repo.findById(id);
  }
  create(data: Partial<Role>): Role {
    if (!data) throw new Error('数据不能为空');
    return this.repo.create(data);
  }
  update(id: number, data: Partial<Role>): Role {
    const item = this.repo.update(id, data);
    if (!item) throw new Error('未找到资源');
    return item;
  }
  delete(id: number): Role {
    const item = this.repo.delete(id);
    if (!item) throw new Error('未找到资源');
    return item;
  }
}

// ---- Controller 层 ----
class RoleController {
  constructor(private service: RoleService) {}
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

const repo = new RoleRepository();
const service = new RoleService(repo);
const controller = new RoleController(service);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '多角色后台系统' });
});
app.get('/api/roles', controller.list.bind(controller));
app.get('/api/roles/:id', controller.get.bind(controller));
app.post('/api/roles', controller.create.bind(controller));
app.put('/api/roles/:id', controller.update.bind(controller));
app.delete('/api/roles/:id', controller.delete.bind(controller));

// 错误处理中间件
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[多角色后台系统] running at http://localhost:' + PORT);
});
