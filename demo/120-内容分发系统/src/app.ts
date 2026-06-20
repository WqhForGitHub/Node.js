import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 内容分发系统
 * CDN 边缘节点注册、源内容上传、分发到节点并模拟复制进度
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Node {
  id: number;
  name: string;
  region: string;
  bandwidth: number;
  createdAt: string;
}
interface Content {
  id: number;
  key: string;
  size: number;
  data: string;
  distributions: { nodeId: number; status: 'pending' | 'copying' | 'done'; progress: number }[];
  createdAt: string;
}

// 仓储层
class CdnRepository {
  private nodes: Node[] = [];
  private contents: Content[] = [];
  private nSeq = 0;
  private cSeq = 0;
  createNode(data: any): Node {
    const n: Node = {
      id: ++this.nSeq,
      name: data.name,
      region: data.region,
      bandwidth: data.bandwidth,
      createdAt: new Date().toISOString(),
    };
    this.nodes.push(n);
    return n;
  }
  findNode(id: number) { return this.nodes.find((n) => n.id === id); }
  listNodes(region: string | null) {
    return region ? this.nodes.filter((n) => n.region === region) : this.nodes;
  }
  createContent(data: any): Content {
    const c: Content = {
      id: ++this.cSeq,
      key: data.key,
      size: Buffer.byteLength(data.data || ''),
      data: data.data || '',
      distributions: [],
      createdAt: new Date().toISOString(),
    };
    this.contents.push(c);
    return c;
  }
  findContent(id: number) { return this.contents.find((c) => c.id === id); }
  distribute(content: Content, nodeIds: number[]) {
    nodeIds.forEach((nodeId) => {
      const dist: { nodeId: number; status: 'pending' | 'copying' | 'done'; progress: number } = { nodeId, status: 'pending', progress: 0 };
      content.distributions.push(dist);
      // 模拟复制进度，每 700ms +25
      const timer = setInterval(() => {
        dist.progress += 25;
        dist.status = dist.progress >= 100 ? 'done' : 'copying';
        if (dist.status === 'done') clearInterval(timer);
      }, 700);
    });
  }
}

// 服务层
class CdnService {
  constructor(private repo: CdnRepository) {}
  createNode(data: any) {
    if (!data.name || !data.region || data.bandwidth === undefined) {
      throw new Error('参数缺失: name/region/bandwidth');
    }
    return this.repo.createNode(data);
  }
  nodes(region: string | null) { return this.repo.listNodes(region); }
  createContent(data: any) {
    if (!data.key) throw new Error('key 必填');
    return this.repo.createContent(data);
  }
  distribute(id: number, nodeIds: number[]) {
    const c = this.repo.findContent(id);
    if (!c) return null;
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) throw new Error('nodeIds 必填且非空');
    // 校验节点是否存在
    for (const nid of nodeIds) {
      if (!this.repo.findNode(nid)) throw new Error(`节点 ${nid} 不存在`);
    }
    this.repo.distribute(c, nodeIds);
    return c.distributions;
  }
  distribution(id: number) {
    const c = this.repo.findContent(id);
    return c ? c.distributions : null;
  }
}

const repo = new CdnRepository();
const service = new CdnService(repo);

// POST /api/nodes - 注册边缘节点
router.post('/api/nodes', (ctx) => {
  try { ctx.status = 201; ctx.body = service.createNode(ctx.request.body || {}); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// GET /api/nodes - 节点列表（按 region 过滤）
router.get('/api/nodes', (ctx) => { ctx.body = service.nodes((ctx.query.region as string) || null); });
// POST /api/content - 上传源内容
router.post('/api/content', (ctx) => {
  try { ctx.status = 201; ctx.body = service.createContent(ctx.request.body || {}); }
  catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// POST /api/content/:id/distribute - 分发到指定节点
router.post('/api/content/:id/distribute', (ctx) => {
  try {
    const r = service.distribute(Number(ctx.params.id), (ctx.request.body as any).nodeIds);
    if (r === null) { ctx.status = 404; ctx.body = { message: '内容不存在' }; return; }
    ctx.status = 202; ctx.body = r;
  } catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// GET /api/content/:id/distribution - 各节点分发状态
router.get('/api/content/:id/distribution', (ctx) => {
  const d = service.distribution(Number(ctx.params.id));
  if (d === null) { ctx.status = 404; ctx.body = { message: '内容不存在' }; return; }
  ctx.body = d;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[内容分发系统] running at http://localhost:' + PORT));
