import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 短链接系统
 * 长链生成短链，base62 编码自增 id，302 跳转与点击统计
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

// base62 字符表与编码函数
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function encodeBase62(num: number): string {
  if (num === 0) return BASE62[0];
  let out = '';
  while (num > 0) {
    out = BASE62[num % 62] + out;
    num = Math.floor(num / 62);
  }
  return out;
}

interface ShortLink {
  id: number;
  code: string;
  url: string;
  clicks: number;
  recentAccess: string[];
  createdAt: string;
}

// 仓储层
class ShortLinkRepository {
  private links: ShortLink[] = [];
  private seq = 0;
  create(url: string): ShortLink {
    const id = ++this.seq;
    const link: ShortLink = {
      id,
      code: encodeBase62(id),
      url,
      clicks: 0,
      recentAccess: [],
      createdAt: new Date().toISOString(),
    };
    this.links.push(link);
    return link;
  }
  findByCode(code: string) { return this.links.find((l) => l.code === code); }
  recordClick(code: string) {
    const l = this.findByCode(code);
    if (!l) return null;
    l.clicks++;
    l.recentAccess.push(new Date().toISOString());
    if (l.recentAccess.length > 10) l.recentAccess.shift();
    return l;
  }
  all() { return this.links; }
}

// 服务层
class ShortLinkService {
  constructor(private repo: ShortLinkRepository) {}
  create(url: string) {
    if (!url) throw new Error('url 必填');
    return this.repo.create(url);
  }
  redirect(code: string) { return this.repo.recordClick(code); }
  stats(code: string) {
    const l = this.repo.findByCode(code);
    if (!l) return null;
    return { code: l.code, url: l.url, clicks: l.clicks, recentAccess: l.recentAccess };
  }
  list() { return this.repo.all(); }
}

const repo = new ShortLinkRepository();
const service = new ShortLinkService(repo);

// POST /api/short-links - 长链生成短链
router.post('/api/short-links', (ctx) => {
  try {
    const l = service.create((ctx.request.body as any).url);
    ctx.status = 201;
    ctx.body = { id: l.id, code: l.code, url: l.url, shortUrl: `http://localhost:${process.env.PORT || 3000}/${l.code}` };
  } catch (e: any) { ctx.status = 400; ctx.body = { message: e.message }; }
});
// GET /api/short-links - 管理列表
router.get('/api/short-links', (ctx) => { ctx.body = service.list(); });
// GET /api/short-links/:code/stats - 点击次数与最近访问
router.get('/api/short-links/:code/stats', (ctx) => {
  const s = service.stats(ctx.params.code);
  if (!s) { ctx.status = 404; ctx.body = { message: '短链不存在' }; return; }
  ctx.body = s;
});
// GET /:code - 302 重定向到长链并记录点击（放在最后避免与其他路由冲突）
router.get('/:code', (ctx) => {
  // 排除明显非短链 code（长度过长或包含 / ）
  if (ctx.params.code.length > 12) { ctx.status = 404; ctx.body = { message: '短链不存在' }; return; }
  const l = service.redirect(ctx.params.code);
  if (!l) { ctx.status = 404; ctx.body = { message: '短链不存在' }; return; }
  ctx.redirect(l.url);
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[短链接系统] running at http://localhost:' + PORT));
