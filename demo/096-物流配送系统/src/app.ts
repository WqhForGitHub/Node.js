import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 物流配送系统
 * 运单创建、状态更新、轨迹查询（按时间排序）
 */

type ShipmentStatus = 'created' | 'in_transit' | 'delivered';

interface Track {
  location: string;
  status: string;
  time: string;
}

interface Shipment {
  id: number;
  orderId: number;
  carrier: string;
  status: ShipmentStatus;
  tracks: Track[];
}

// ---- Repository 层 ----
class ShipmentRepository {
  private shipments: Shipment[] = [];
  create(s: Shipment) {
    this.shipments.push(s);
    return s;
  }
  findById(id: number) {
    return this.shipments.find((s) => s.id === id);
  }
}

// ---- Service 层 ----
class ShipmentService {
  constructor(private repo: ShipmentRepository) {}
  create(orderId: number, carrier: string) {
    if (!orderId) throw new Error('缺少 orderId');
    if (!carrier) throw new Error('缺少 carrier');
    const s: Shipment = {
      id: Date.now(),
      orderId,
      carrier,
      status: 'created',
      tracks: [
        {
          location: '始发地',
          status: '已揽收',
          time: new Date().toISOString(),
        },
      ],
    };
    return this.repo.create(s);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  // 添加轨迹点
  addTrack(id: number, location: string, status: string) {
    if (!location) throw new Error('缺少 location');
    if (!status) throw new Error('缺少 status');
    const s = this.repo.findById(id);
    if (!s) throw new Error('运单不存在');
    const t: Track = { location, status, time: new Date().toISOString() };
    s.tracks.push(t);
    // 自动更新状态
    if (status === '签收' || status === 'delivered') s.status = 'delivered';
    else s.status = 'in_transit';
    return t;
  }
  // 轨迹列表（按时间排序）
  tracks(id: number) {
    const s = this.repo.findById(id);
    if (!s) return null;
    return [...s.tracks].sort((a, b) => a.time.localeCompare(b.time));
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new ShipmentService(new ShipmentRepository());

// 创建运单
router.post('/api/shipments', (ctx) => {
  const { orderId, carrier } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.create(Number(orderId), carrier);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询运单
router.get('/api/shipments/:id', (ctx) => {
  const s = service.get(Number(ctx.params.id));
  if (!s) {
    ctx.status = 404;
    ctx.body = { message: '运单不存在' };
    return;
  }
  ctx.body = s;
});
// 添加轨迹点
router.post('/api/shipments/:id/track', (ctx) => {
  const { location, status } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.addTrack(Number(ctx.params.id), location, status);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询轨迹
router.get('/api/shipments/:id/track', (ctx) => {
  const t = service.tracks(Number(ctx.params.id));
  if (t === null) {
    ctx.status = 404;
    ctx.body = { message: '运单不存在' };
    return;
  }
  ctx.body = t;
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[物流配送系统] running at http://localhost:' + PORT);
});
