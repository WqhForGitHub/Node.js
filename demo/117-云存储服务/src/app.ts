import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 云存储服务
 * bucket 与 object 管理，支持对象上传、列表、下载、删除
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Obj {
  key: string;
  content: string;
  size: number;
  createdAt: string;
}
interface Bucket {
  name: string;
  objects: Map<string, Obj>;
  createdAt: string;
}

// 仓储层
class StorageRepository {
  private buckets = new Map<string, Bucket>();
  createBucket(name: string): Bucket {
    if (this.buckets.has(name)) throw new Error('bucket 已存在');
    const b: Bucket = { name, objects: new Map(), createdAt: new Date().toISOString() };
    this.buckets.set(name, b);
    return b;
  }
  listBuckets() {
    return [...this.buckets.values()].map(({ objects, ...rest }) => ({
      ...rest,
      objectCount: objects.size,
    }));
  }
  getBucket(name: string) {
    return this.buckets.get(name);
  }
  putObject(bucketName: string, key: string, content: string): Obj | null {
    const b = this.getBucket(bucketName);
    if (!b) return null;
    const obj: Obj = {
      key,
      content,
      size: Buffer.byteLength(content),
      createdAt: new Date().toISOString(),
    };
    b.objects.set(key, obj);
    return obj;
  }
  listObjects(bucketName: string) {
    const b = this.getBucket(bucketName);
    if (!b) return null;
    return [...b.objects.values()].map(({ content, ...rest }) => rest);
  }
  getObject(bucketName: string, key: string) {
    const b = this.getBucket(bucketName);
    if (!b) return null;
    return b.objects.get(key) || null;
  }
  deleteObject(bucketName: string, key: string): boolean | null {
    const b = this.getBucket(bucketName);
    if (!b) return null;
    return b.objects.delete(key);
  }
}

// 服务层
class StorageService {
  constructor(private repo: StorageRepository) {}
  createBucket(name: string) {
    if (!name) throw new Error('name 必填');
    return this.repo.createBucket(name);
  }
  buckets() {
    return this.repo.listBuckets();
  }
  putObject(bucket: string, data: any) {
    if (!data.key || data.content === undefined) throw new Error('参数缺失: key/content');
    const o = this.repo.putObject(bucket, data.key, String(data.content));
    if (o === null) return null;
    return o;
  }
  listObjects(bucket: string) {
    return this.repo.listObjects(bucket);
  }
  getObject(bucket: string, key: string) {
    return this.repo.getObject(bucket, key);
  }
  deleteObject(bucket: string, key: string) {
    return this.repo.deleteObject(bucket, key);
  }
}

const repo = new StorageRepository();
const service = new StorageService(repo);

// POST /api/buckets - 创建 bucket
router.post('/api/buckets', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.createBucket((ctx.request.body as any).name);
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/buckets - bucket 列表
router.get('/api/buckets', (ctx) => {
  ctx.body = service.buckets();
});
// POST /api/buckets/:bucket/objects - 上传对象
router.post('/api/buckets/:bucket/objects', (ctx) => {
  try {
    const o = service.putObject(ctx.params.bucket, ctx.request.body || {});
    if (o === null) {
      ctx.status = 404;
      ctx.body = { message: 'bucket 不存在' };
      return;
    }
    ctx.status = 201;
    ctx.body = o;
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/buckets/:bucket/objects - 对象列表
router.get('/api/buckets/:bucket/objects', (ctx) => {
  const list = service.listObjects(ctx.params.bucket);
  if (list === null) {
    ctx.status = 404;
    ctx.body = { message: 'bucket 不存在' };
    return;
  }
  ctx.body = list;
});
// GET /api/buckets/:bucket/objects/:key - 下载对象
router.get('/api/buckets/:bucket/objects/:key', (ctx) => {
  const o = service.getObject(ctx.params.bucket, ctx.params.key);
  if (!o) {
    ctx.status = 404;
    ctx.body = { message: '对象不存在' };
    return;
  }
  ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(o.key)}"`);
  ctx.body = o.content;
});
// DELETE /api/buckets/:bucket/objects/:key - 删除对象
router.delete('/api/buckets/:bucket/objects/:key', (ctx) => {
  const r = service.deleteObject(ctx.params.bucket, ctx.params.key);
  if (r === null) {
    ctx.status = 404;
    ctx.body = { message: 'bucket 不存在' };
    return;
  }
  if (!r) {
    ctx.status = 404;
    ctx.body = { message: '对象不存在' };
    return;
  }
  ctx.status = 204;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[云存储服务] running at http://localhost:' + PORT));
