import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 仓储管理系统
 * 仓库、库位、库存移动（库间调拨）
 */

interface Warehouse {
  id: number;
  name: string;
  location: string;
}

interface Inventory {
  warehouseId: number;
  sku: string;
  qty: number;
}

interface MoveRecord {
  id: number;
  sku: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  qty: number;
  createdAt: string;
}

// ---- Repository 层 ----
class WarehouseRepository {
  private warehouses: Warehouse[] = [
    { id: 1, name: '北京仓', location: '北京' },
    { id: 2, name: '上海仓', location: '上海' },
  ];
  private inventories: Inventory[] = [
    { warehouseId: 1, sku: 'SKU-A', qty: 100 },
    { warehouseId: 2, sku: 'SKU-A', qty: 20 },
  ];
  private moves: MoveRecord[] = [];
  findWarehouses() {
    return this.warehouses;
  }
  findWarehouse(id: number) {
    return this.warehouses.find((w) => w.id === id);
  }
  addWarehouse(w: Warehouse) {
    this.warehouses.push(w);
    return w;
  }
  findInventory(warehouseId: number, sku: string) {
    return this.inventories.find((i) => i.warehouseId === warehouseId && i.sku === sku);
  }
  findInventoriesByWarehouse(warehouseId: number) {
    return this.inventories.filter((i) => i.warehouseId === warehouseId);
  }
  ensureInventory(warehouseId: number, sku: string) {
    let inv = this.findInventory(warehouseId, sku);
    if (!inv) {
      inv = { warehouseId, sku, qty: 0 };
      this.inventories.push(inv);
    }
    return inv;
  }
  addMove(m: MoveRecord) {
    this.moves.push(m);
    return m;
  }
}

// ---- Service 层 ----
class WarehouseService {
  constructor(private repo: WarehouseRepository) {}
  listWarehouses() {
    return this.repo.findWarehouses();
  }
  createWarehouse(name: string, location: string) {
    if (!name) throw new Error('缺少 name');
    if (!location) throw new Error('缺少 location');
    return this.repo.addWarehouse({ id: Date.now(), name, location });
  }
  inventoryOf(warehouseId: number) {
    return this.repo.findInventoriesByWarehouse(warehouseId);
  }
  // 库间调拨
  move(sku: string, fromWarehouseId: number, toWarehouseId: number, qty: number) {
    if (!sku) throw new Error('缺少 sku');
    if (!fromWarehouseId || !toWarehouseId) throw new Error('缺少 from/to');
    if (fromWarehouseId === toWarehouseId) throw new Error('源仓库和目标仓库不能相同');
    if (!qty || qty <= 0) throw new Error('qty 必须大于 0');
    if (!this.repo.findWarehouse(fromWarehouseId)) throw new Error('源仓库不存在');
    if (!this.repo.findWarehouse(toWarehouseId)) throw new Error('目标仓库不存在');
    const fromInv = this.repo.findInventory(fromWarehouseId, sku);
    if (!fromInv || fromInv.qty < qty) throw new Error('源库存不足');
    const toInv = this.repo.ensureInventory(toWarehouseId, sku);
    fromInv.qty -= qty;
    toInv.qty += qty;
    const move: MoveRecord = {
      id: Date.now(),
      sku,
      fromWarehouseId,
      toWarehouseId,
      qty,
      createdAt: new Date().toISOString(),
    };
    return this.repo.addMove(move);
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new WarehouseService(new WarehouseRepository());

// 仓库列表
router.get('/api/warehouses', (ctx) => {
  ctx.body = service.listWarehouses();
});
// 创建仓库
router.post('/api/warehouses', (ctx) => {
  const { name, location } = (ctx.request.body as any) || {};
  try {
    ctx.status = 201;
    ctx.body = service.createWarehouse(name, location);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 库间调拨
router.post('/api/inventory/move', (ctx) => {
  const { sku, fromWarehouseId, toWarehouseId, qty } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.move(sku, Number(fromWarehouseId), Number(toWarehouseId), Number(qty));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 查询仓库库存
router.get('/api/warehouses/:id/inventory', (ctx) => {
  ctx.body = service.inventoryOf(Number(ctx.params.id));
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[仓储管理系统] running at http://localhost:' + PORT);
});
