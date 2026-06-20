import express, { Request, Response } from 'express';
import { EventEmitter } from 'events';

/**
 * 事件驱动系统
 * Express + TypeScript 事件驱动示例
 */
interface Order {
  id: number;
  product: string;
  qty: number;
  status: string;
  createdAt: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const eventBus = new EventEmitter();
const orders: Order[] = [];
let nextId = 1;

// 事件监听
eventBus.on('order:created', (order: Order) => {
  console.log('[事件] 订单已创建:', order.id);
  // 模拟库存扣减
  order.status = 'processing';
  eventBus.emit('inventory:deducted', order);
});

eventBus.on('inventory:deducted', (order: Order) => {
  console.log('[事件] 库存已扣减:', order.id);
  // 模拟支付
  setTimeout(() => {
    order.status = 'paid';
    eventBus.emit('order:paid', order);
  }, 100);
});

eventBus.on('order:paid', (order: Order) => {
  console.log('[事件] 订单已支付:', order.id);
  order.status = 'completed';
});

eventBus.on('order:cancelled', (order: Order) => {
  console.log('[事件] 订单已取消:', order.id);
  order.status = 'cancelled';
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '事件驱动系统' });
});

// 创建订单
app.post('/api/orders', (req: Request, res: Response) => {
  const { product, qty } = req.body || {};
  if (!product || !qty) {
    res.status(400).json({ message: '缺少 product 或 qty' });
    return;
  }
  const order: Order = {
    id: nextId++,
    product,
    qty: Number(qty),
    status: 'created',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  eventBus.emit('order:created', order);
  res.status(201).json(order);
});

// 取消订单
app.post('/api/orders/:id/cancel', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === Number(req.params.id));
  if (!order) {
    res.status(404).json({ message: '订单不存在' });
    return;
  }
  eventBus.emit('order:cancelled', order);
  res.json(order);
});

// 查询订单
app.get('/api/orders', (_req: Request, res: Response) => {
  res.json(orders);
});

app.get('/api/orders/:id', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === Number(req.params.id));
  if (!order) {
    res.status(404).json({ message: '订单不存在' });
    return;
  }
  res.json(order);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[事件驱动系统] running at http://localhost:' + PORT);
});
