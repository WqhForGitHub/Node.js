import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 后台管理API
 * 后台仪表盘统计、用户、订单、操作日志
 */

interface AdminUser {
  id: number;
  username: string;
  status: 'active' | 'disabled';
  createdAt: string;
}
interface AdminOrder {
  id: number;
  amount: number;
  status: 'paid' | 'unpaid' | 'shipped';
  createdAt: string;
}
interface OpLog {
  id: number;
  action: string;
  operator: string;
  time: string;
}

// ---- Repository 层 ----
class AdminRepository {
  private users: AdminUser[] = [
    { id: 1, username: 'admin', status: 'active', createdAt: '2024-01-01' },
    { id: 2, username: 'alice', status: 'active', createdAt: '2024-02-10' },
    { id: 3, username: 'bob', status: 'disabled', createdAt: '2024-03-15' },
  ];
  private orders: AdminOrder[] = [
    { id: 101, amount: 199.0, status: 'paid', createdAt: '2024-04-01' },
    { id: 102, amount: 88.5, status: 'unpaid', createdAt: '2024-04-02' },
    { id: 103, amount: 1299.0, status: 'shipped', createdAt: '2024-04-03' },
  ];
  private logs: OpLog[] = [
    { id: 1, action: '登录后台', operator: 'admin', time: '2024-04-03 10:00' },
    { id: 2, action: '禁用用户 bob', operator: 'admin', time: '2024-04-03 11:00' },
    { id: 3, action: '查看订单 103', operator: 'alice', time: '2024-04-03 12:00' },
  ];
  countUsers() {
    return this.users.length;
  }
  countOrders() {
    return this.orders.length;
  }
  sumRevenue() {
    return this.orders.filter((o) => o.status === 'paid' || o.status === 'shipped')
      .reduce((s, o) => s + o.amount, 0);
  }
  listUsers() {
    return this.users;
  }
  listOrders() {
    return this.orders;
  }
  recentLogs(limit: number) {
    return this.logs.slice(-limit).reverse();
  }
}

// ---- Service 层 ----
class AdminService {
  constructor(private repo: AdminRepository) {}
  dashboard() {
    return {
      userCount: this.repo.countUsers(),
      orderCount: this.repo.countOrders(),
      revenue: this.repo.sumRevenue(),
    };
  }
  listUsers() {
    return this.repo.listUsers();
  }
  listOrders() {
    return this.repo.listOrders();
  }
  recentLogs() {
    return this.repo.recentLogs(20);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new AdminService(new AdminRepository());

// GET /api/dashboard - 仪表盘统计
router.get('/api/dashboard', (ctx) => {
  ctx.body = service.dashboard();
});

// GET /api/admin/users - 后台用户列表
router.get('/api/admin/users', (ctx) => {
  ctx.body = service.listUsers();
});

// GET /api/admin/orders - 后台订单列表
router.get('/api/admin/orders', (ctx) => {
  ctx.body = service.listOrders();
});

// GET /api/admin/logs - 最近操作日志
router.get('/api/admin/logs', (ctx) => {
  ctx.body = service.recentLogs();
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[后台管理API] running at http://localhost:' + PORT);
});
