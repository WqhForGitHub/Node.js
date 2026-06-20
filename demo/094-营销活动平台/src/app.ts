import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 营销活动平台
 * 活动 CRUD、参与、抽奖（随机发奖）
 */

type CampaignStatus = 'draft' | 'running' | 'ended';

interface Prize {
  name: string;
  qty: number;
}

interface Campaign {
  id: number;
  name: string;
  type: string;
  startAt: string;
  endAt: string;
  status: CampaignStatus;
  participants: number[];
  prizes: Prize[];
}

// ---- Repository 层 ----
class CampaignRepository {
  private campaigns: Campaign[] = [];
  findAll() {
    return this.campaigns;
  }
  findById(id: number) {
    return this.campaigns.find((c) => c.id === id);
  }
  create(c: Campaign) {
    this.campaigns.push(c);
    return c;
  }
}

// ---- Service 层 ----
class CampaignService {
  constructor(private repo: CampaignRepository) {}
  list() {
    return this.repo.findAll();
  }
  create(data: Partial<Campaign>) {
    if (!data.name) throw new Error('缺少 name');
    const c: Campaign = {
      id: Date.now(),
      name: data.name,
      type: data.type || 'normal',
      startAt: data.startAt || new Date().toISOString(),
      endAt: data.endAt || '',
      status: data.status || 'running',
      participants: [],
      prizes: data.prizes || [],
    };
    return this.repo.create(c);
  }
  get(id: number) {
    return this.repo.findById(id);
  }
  // 参与活动
  join(id: number, userId: number) {
    if (!userId) throw new Error('缺少 userId');
    const c = this.repo.findById(id);
    if (!c) throw new Error('活动不存在');
    if (c.status !== 'running') throw new Error('活动未进行中');
    if (c.participants.includes(userId)) throw new Error('已参与该活动');
    c.participants.push(userId);
    return { joined: true, total: c.participants.length };
  }
  // 参与者列表
  participants(id: number) {
    const c = this.repo.findById(id);
    if (!c) return null;
    return c.participants;
  }
  // 抽奖：随机发奖
  draw(id: number) {
    const c = this.repo.findById(id);
    if (!c) throw new Error('活动不存在');
    if (c.status !== 'running') throw new Error('活动未进行中');
    if (c.participants.length === 0) throw new Error('无参与者');
    const available = c.prizes.filter((p) => p.qty > 0);
    if (available.length === 0) throw new Error('奖品已发完');
    // 随机选奖品
    const prize = available[Math.floor(Math.random() * available.length)];
    // 随机选中参与者
    const winner = c.participants[Math.floor(Math.random() * c.participants.length)];
    prize.qty -= 1;
    return { winner, prize: prize.name };
  }
}

// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new CampaignService(new CampaignRepository());

// 活动列表
router.get('/api/campaigns', (ctx) => {
  ctx.body = service.list();
});
// 创建活动
router.post('/api/campaigns', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create((ctx.request.body as any) || {});
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 参与活动
router.post('/api/campaigns/:id/join', (ctx) => {
  const { userId } = (ctx.request.body as any) || {};
  try {
    ctx.body = service.join(Number(ctx.params.id), Number(userId));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
// 参与者列表
router.get('/api/campaigns/:id/participants', (ctx) => {
  const r = service.participants(Number(ctx.params.id));
  if (r === null) {
    ctx.status = 404;
    ctx.body = { message: '活动不存在' };
    return;
  }
  ctx.body = r;
});
// 抽奖
router.post('/api/campaigns/:id/draw', (ctx) => {
  try {
    ctx.body = service.draw(Number(ctx.params.id));
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[营销活动平台] running at http://localhost:' + PORT);
});
