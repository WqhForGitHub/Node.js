import express, { Request, Response } from 'express';

/**
 * 架构设计模板
 * Express + TypeScript DDD/领域驱动设计示例
 */

// ---- 领域层 (Domain Layer) ----
// 实体
class User {
  constructor(
    public readonly id: number,
    public email: string,
    public name: string,
    public status: 'active' | 'inactive' = 'active'
  ) {}

  changeName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('用户名不能为空');
    }
    this.name = name;
  }

  deactivate(): void {
    this.status = 'inactive';
  }

  activate(): void {
    this.status = 'active';
  }
}

// 值对象
interface Email {
  value: string;
}

// 领域服务
class UserDomainService {
  validateEmail(email: string): boolean {
    return /^[^@]+@[^@]+\.[^@]+$/.test(email);
  }
}

// ---- 应用层 (Application Layer) ----
interface CreateUserDTO {
  email: string;
  name: string;
}

interface UserDTO {
  id: number;
  email: string;
  name: string;
  status: string;
}

// 仓储接口（端口）
interface UserRepository {
  findById(id: number): User | undefined;
  findAll(): User[];
  save(user: User): User;
  delete(id: number): boolean;
}

// 用例
class UserUseCase {
  constructor(
    private repo: UserRepository,
    private domainService: UserDomainService
  ) {}

  createUser(dto: CreateUserDTO): UserDTO {
    if (!this.domainService.validateEmail(dto.email)) {
      throw new Error('邮箱格式不正确');
    }
    const user = new User(Date.now(), dto.email, dto.name);
    this.repo.save(user);
    return this.toDTO(user);
  }

  getUser(id: number): UserDTO {
    const user = this.repo.findById(id);
    if (!user) throw new Error('用户不存在');
    return this.toDTO(user);
  }

  listUsers(): UserDTO[] {
    return this.repo.findAll().map((u) => this.toDTO(u));
  }

  changeName(id: number, name: string): UserDTO {
    const user = this.repo.findById(id);
    if (!user) throw new Error('用户不存在');
    user.changeName(name);
    this.repo.save(user);
    return this.toDTO(user);
  }

  private toDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  }
}

// ---- 基础设施层 (Infrastructure Layer) ----
class InMemoryUserRepository implements UserRepository {
  private users: Map<number, User> = new Map();

  constructor() {
    const u = new User(1, 'admin@example.com', 'Admin');
    this.users.set(1, u);
  }

  findById(id: number): User | undefined {
    return this.users.get(id);
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  save(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  delete(id: number): boolean {
    return this.users.delete(id);
  }
}

// ---- 适配层 (Adapter/Controller) ----
const app = express();
app.use(express.json());

const repo = new InMemoryUserRepository();
const domainService = new UserDomainService();
const useCase = new UserUseCase(repo, domainService);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '架构设计模板' });
});

app.get('/api/users', (_req: Request, res: Response) => {
  res.json(useCase.listUsers());
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  try {
    res.json(useCase.getUser(Number(req.params.id)));
  } catch (e) {
    res.status(404).json({ message: (e as Error).message });
  }
});

app.post('/api/users', (req: Request, res: Response) => {
  try {
    res.status(201).json(useCase.createUser(req.body));
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
  }
});

app.put('/api/users/:id/name', (req: Request, res: Response) => {
  try {
    res.json(useCase.changeName(Number(req.params.id), req.body.name));
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[架构设计模板] running at http://localhost:' + PORT);
});
