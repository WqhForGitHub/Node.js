import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 短信发送服务
 * 短信模板、发送、回执
 */
interface SmsTemplate {
  code: string;
  content: string;
}
interface SmsRecord {
  id: number;
  templateCode: string;
  phone: string;
  content: string;
  status: 'queued' | 'delivered' | 'failed';
  createdAt: number;
  deliveredAt: number | null;
}

// ---- Repository 层 ----
class SmsRepository {
  private templates: Map<string, SmsTemplate> = new Map();
  private records: SmsRecord[] = [];
  addTemplate(t: SmsTemplate) {
    this.templates.set(t.code, t);
    return t;
  }
  findTemplate(code: string) {
    return this.templates.get(code);
  }
  listTemplates() {
    return Array.from(this.templates.values());
  }
  addRecord(r: SmsRecord) {
    this.records.push(r);
    return r;
  }
  findRecord(id: number) {
    return this.records.find((r) => r.id === id);
  }
  listRecords() {
    return this.records;
  }
  markDelivered(id: number, status: 'delivered' | 'failed') {
    const r = this.findRecord(id);
    if (!r) return null;
    r.status = status;
    r.deliveredAt = Date.now();
    return r;
  }
}
// ---- Service 层 ----
class SmsService {
  constructor(private repo: SmsRepository) {}
  createTemplate(code: string, content: string) {
    if (!code || !content) throw new Error('参数缺失: code/content');
    if (!content.includes('${')) throw new Error('模板 content 必须包含 ${var} 占位符');
    return this.repo.addTemplate({ code, content });
  }
  listTemplates() {
    return this.repo.listTemplates();
  }
  // 模板变量替换
  render(content: string, params: Record<string, string>) {
    return content.replace(/\$\{(\w+)\}/g, (_, k) =>
      params[k] !== undefined ? params[k] : '${' + k + '}',
    );
  }
  send(templateCode: string, phone: string, params: Record<string, string>) {
    if (!templateCode || !phone) throw new Error('参数缺失: templateCode/phone');
    const tpl = this.repo.findTemplate(templateCode);
    if (!tpl) throw new Error('模板不存在');
    const content = this.render(tpl.content, params || {});
    return this.repo.addRecord({
      id: Date.now() + Math.floor(Math.random() * 1000),
      templateCode,
      phone,
      content,
      status: 'queued',
      createdAt: Date.now(),
      deliveredAt: null,
    });
  }
  callback(id: number, status: 'delivered' | 'failed') {
    const r = this.repo.markDelivered(id, status);
    if (!r) throw new Error('短信记录不存在');
    return r;
  }
  listRecords() {
    return this.repo.listRecords();
  }
}
// ---- 装配与路由 ----
const app = new Koa();
const router = new Router();
app.use(bodyParser());
const service = new SmsService(new SmsRepository());

router.get('/api/sms/templates', (ctx) => {
  ctx.body = service.listTemplates();
});
router.post('/api/sms/templates', (ctx) => {
  try {
    const { code, content } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.createTemplate(code, content);
  } catch (e) {
    ctx.status = 400;
    ctx.body = { message: (e as Error).message };
  }
});
router.post('/api/sms/send', (ctx) => {
  try {
    const { templateCode, phone, params } = (ctx.request.body || {}) as any;
    ctx.status = 201;
    ctx.body = service.send(templateCode, phone, params);
  } catch (e) {
    const m = (e as Error).message;
    ctx.status = m === '模板不存在' ? 404 : 400;
    ctx.body = { message: m };
  }
});
router.get('/api/sms/records', (ctx) => {
  ctx.body = service.listRecords();
});
router.post('/api/sms/:id/callback', (ctx) => {
  try {
    const { status } = (ctx.request.body || {}) as any;
    ctx.body = service.callback(Number(ctx.params.id), status);
  } catch (e) {
    const m = (e as Error).message;
    ctx.status = m === '短信记录不存在' ? 404 : 400;
    ctx.body = { message: m };
  }
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[短信发送服务] running at http://localhost:' + PORT);
});
