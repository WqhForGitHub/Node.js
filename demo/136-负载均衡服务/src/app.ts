import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import crypto from 'crypto';

/**
 * 负载均衡服务
 * 负载均衡器 + 多策略（round-robin / random / least-conn）
 */

// ---- 类型定义 ----
type Strategy = 'round-robin' | 'random' | 'least-conn';

interface PoolServer {
  id: string;
  url: string;
  status: 'up' | 'down';
  calls: number; // 总调用次数
  activeConn: number; // 当前活动连接数（模拟）
}

interface Pool {
  id: string;
  name: string;
  strategy: Strategy;
  servers: PoolServer[];
  rrIndex: number; // 轮询游标
  createdAt: number;
}

// ---- Repository 层 ----
class PoolRepository {
  private pools: Map<string, Pool> = new Map();

  insert(p: Pool): void {
    this.pools.set(p.id, p);
  }

  findById(id: string): Pool | undefined {
    return this.pools.get(id);
  }

  findAll(): Pool[] {
    return Array.from(this.pools.values());
  }
}

// ---- Service 层 ----
class LbService {
  constructor(private repo: PoolRepository) {}

  create(data: any): Pool {
    if (!data.name) throw { status: 400, message: 'name required' };
    const strategy: Strategy = data.strategy || 'round-robin';
    const valid: Strategy[] = ['round-robin', 'random', 'least-conn'];
    if (!valid.includes(strategy)) throw { status: 400, message: 'invalid strategy' };
    const pool: Pool = {
      id: crypto.randomBytes(8).toString('hex'),
      name: data.name,
      strategy,
      servers: (data.servers || []).map((s: any) => ({
        id: crypto.randomBytes(4).toString('hex'),
        url: s.url,
        status: 'up',
        calls: 0,
        activeConn: 0,
      })),
      rrIndex: 0,
      createdAt: Date.now(),
    };
    this.repo.insert(pool);
    return pool;
  }

  addServer(poolId: string, data: any): PoolServer {
    const pool = this.repo.findById(poolId);
    if (!pool) throw { status: 404, message: 'pool not found' };
    if (!data.url) throw { status: 400, message: 'server url required' };
    const s: PoolServer = {
      id: crypto.randomBytes(4).toString('hex'),
      url: data.url,
      status: 'up',
      calls: 0,
      activeConn: 0,
    };
    pool.servers.push(s);
    return s;
  }

  listPools(): Pool[] {
    return this.repo.findAll();
  }

  // 按策略选一个 server
  acquire(poolId: string): PoolServer {
    const pool = this.repo.findById(poolId);
    if (!pool) throw { status: 404, message: 'pool not found' };
    const available = pool.servers.filter((s) => s.status === 'up');
    if (!available.length) throw { status: 503, message: 'no available server' };
    let chosen: PoolServer;
    if (pool.strategy === 'random') {
      chosen = available[Math.floor(Math.random() * available.length)];
    } else if (pool.strategy === 'least-conn') {
      chosen = available.reduce(
        (min, s) => (s.activeConn < min.activeConn ? s : min),
        available[0],
      );
    } else {
      // round-robin
      chosen = available[pool.rrIndex % available.length];
      pool.rrIndex = (pool.rrIndex + 1) % available.length;
    }
    chosen.calls++;
    chosen.activeConn++;
    // 模拟连接释放
    setTimeout(() => {
      chosen.activeConn = Math.max(0, chosen.activeConn - 1);
    }, 100);
    return chosen;
  }

  stats(poolId: string): any {
    const pool = this.repo.findById(poolId);
    if (!pool) throw { status: 404, message: 'pool not found' };
    return {
      id: pool.id,
      name: pool.name,
      strategy: pool.strategy,
      totalCalls: pool.servers.reduce((s, sv) => s + sv.calls, 0),
      servers: pool.servers.map((s) => ({
        id: s.id,
        url: s.url,
        status: s.status,
        calls: s.calls,
        activeConn: s.activeConn,
      })),
    };
  }
}

// ---- 装配 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new LbService(new PoolRepository());

// POST /api/pools - 创建池
router.post('/api/pools', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create((ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// POST /api/pools/:id/servers - 添加 server
router.post('/api/pools/:id/servers', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.addServer(ctx.params.id, (ctx.request.body as any) || {});
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/pools/:id/acquire - 按策略选一个 server
router.get('/api/pools/:id/acquire', (ctx) => {
  try {
    ctx.body = service.acquire(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/pools/:id/stats - 各 server 调用次数 + 状态
router.get('/api/pools/:id/stats', (ctx) => {
  try {
    ctx.body = service.stats(ctx.params.id);
  } catch (e: any) {
    ctx.status = e.status || 500;
    ctx.body = { message: e.message };
  }
});

// GET /api/pools - 列表（附加）
router.get('/api/pools', (ctx) => {
  ctx.body = service.listPools();
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[负载均衡服务] running at http://localhost:' + PORT);
});
