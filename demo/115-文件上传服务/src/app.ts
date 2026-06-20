import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 文件上传服务
 * base64 模拟上传，元数据管理，支持下载原始内容
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface FileMeta {
  id: number;
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
  createdAt: string;
}

// 仓储层
class FileRepository {
  private files: FileMeta[] = [];
  private seq = 0;
  create(data: any): FileMeta {
    const f: FileMeta = {
      id: ++this.seq,
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
      contentBase64: data.contentBase64,
      createdAt: new Date().toISOString(),
    };
    this.files.push(f);
    return f;
  }
  findById(id: number) {
    return this.files.find((f) => f.id === id);
  }
  list(mimeType: string | null, page: number, size: number) {
    let list = this.files;
    if (mimeType) list = list.filter((f) => f.mimeType === mimeType);
    const total = list.length;
    list = list.slice((page - 1) * size, page * size);
    return { list: list.map(({ contentBase64, ...rest }) => rest), total, page, size };
  }
  delete(id: number) {
    const idx = this.files.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    this.files.splice(idx, 1);
    return true;
  }
}

// 服务层
class FileService {
  constructor(private repo: FileRepository) {}
  create(data: any) {
    if (!data.name || !data.mimeType || data.size === undefined || !data.contentBase64) {
      throw new Error('参数缺失: name/mimeType/size/contentBase64');
    }
    return this.repo.create(data);
  }
  meta(id: number) {
    const f = this.repo.findById(id);
    if (!f) return null;
    const { contentBase64, ...rest } = f;
    return rest;
  }
  list(query: any) {
    return this.repo.list(
      query.mimeType ? String(query.mimeType) : null,
      Number(query.page) || 1,
      Number(query.size) || 10,
    );
  }
  download(id: number) {
    return this.repo.findById(id);
  }
  delete(id: number) {
    return this.repo.delete(id);
  }
}

const repo = new FileRepository();
const service = new FileService(repo);

// POST /api/files - 上传文件（元数据 + base64 内容）
router.post('/api/files', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/files - 列表（mimeType 过滤 + 分页，不含内容）
router.get('/api/files', (ctx) => {
  ctx.body = service.list(ctx.query);
});
// GET /api/files/:id - 元数据
router.get('/api/files/:id', (ctx) => {
  const f = service.meta(Number(ctx.params.id));
  if (!f) {
    ctx.status = 404;
    ctx.body = { message: '文件不存在' };
    return;
  }
  ctx.body = f;
});
// GET /api/files/:id/download - 下载原始内容
router.get('/api/files/:id/download', (ctx) => {
  const f = service.download(Number(ctx.params.id));
  if (!f) {
    ctx.status = 404;
    ctx.body = { message: '文件不存在' };
    return;
  }
  ctx.set('Content-Type', f.mimeType);
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(f.name)}"`);
  ctx.body = Buffer.from(f.contentBase64, 'base64');
});
// DELETE /api/files/:id - 删除文件
router.delete('/api/files/:id', (ctx) => {
  if (!service.delete(Number(ctx.params.id))) {
    ctx.status = 404;
    ctx.body = { message: '文件不存在' };
    return;
  }
  ctx.status = 204;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[文件上传服务] running at http://localhost:' + PORT));
