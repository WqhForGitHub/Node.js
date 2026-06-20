import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 图片处理系统
 * 图片元数据、resize 处理任务（异步 mock 处理），任务状态推进
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Image {
  id: number;
  name: string;
  width: number;
  height: number;
  contentBase64: string;
  variants: { width: number; height: number; taskId: number }[];
}
interface Task {
  id: number;
  imageId: number;
  type: 'resize';
  width: number;
  height: number;
  status: 'pending' | 'processing' | 'done';
  progress: number;
  createdAt: string;
}

// 仓储层
class ImageRepository {
  private images: Image[] = [];
  private tasks: Task[] = [];
  private imgSeq = 0;
  private taskSeq = 0;
  createImage(data: any): Image {
    const img: Image = {
      id: ++this.imgSeq,
      name: data.name,
      width: data.width,
      height: data.height,
      contentBase64: data.contentBase64,
      variants: [],
    };
    this.images.push(img);
    return img;
  }
  findImage(id: number) {
    return this.images.find((i) => i.id === id);
  }
  createTask(imageId: number, width: number, height: number): Task {
    const t: Task = {
      id: ++this.taskSeq,
      imageId,
      type: 'resize',
      width,
      height,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(t);
    // mock 异步处理：每秒推进进度
    const timer = setInterval(() => {
      t.progress += 25;
      t.status = t.progress >= 100 ? 'done' : 'processing';
      if (t.status === 'done') {
        const img = this.findImage(imageId);
        if (img) img.variants.push({ width, height, taskId: t.id });
        clearInterval(timer);
      }
    }, 1000);
    return t;
  }
  findTask(id: number) {
    return this.tasks.find((t) => t.id === id);
  }
}

// 服务层
class ImageService {
  constructor(private repo: ImageRepository) {}
  create(data: any) {
    if (!data.name || !data.width || !data.height || !data.contentBase64) {
      throw new Error('参数缺失: name/width/height/contentBase64');
    }
    return this.repo.createImage(data);
  }
  get(id: number) {
    return this.repo.findImage(id);
  }
  resize(id: number, data: any) {
    const img = this.repo.findImage(id);
    if (!img) return null;
    if (!data.width || !data.height) throw new Error('参数缺失: width/height');
    return this.repo.createTask(id, Number(data.width), Number(data.height));
  }
  task(taskId: number) {
    return this.repo.findTask(taskId);
  }
  variants(id: number) {
    const img = this.repo.findImage(id);
    return img ? img.variants : null;
  }
}

const repo = new ImageRepository();
const service = new ImageService(repo);

// POST /api/images - 上传图片元数据 + base64
router.post('/api/images', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/images/:id - 图片详情
router.get('/api/images/:id', (ctx) => {
  const img = service.get(Number(ctx.params.id));
  if (!img) {
    ctx.status = 404;
    ctx.body = { message: '图片不存在' };
    return;
  }
  ctx.body = img;
});
// POST /api/images/:id/resize - 创建 resize 任务
router.post('/api/images/:id/resize', (ctx) => {
  try {
    const t = service.resize(Number(ctx.params.id), ctx.request.body || {});
    if (!t) {
      ctx.status = 404;
      ctx.body = { message: '图片不存在' };
      return;
    }
    ctx.status = 201;
    ctx.body = { taskId: t.id, status: t.status };
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/tasks/:taskId - 任务状态查询
router.get('/api/tasks/:taskId', (ctx) => {
  const t = service.task(Number(ctx.params.taskId));
  if (!t) {
    ctx.status = 404;
    ctx.body = { message: '任务不存在' };
    return;
  }
  ctx.body = t;
});
// GET /api/images/:id/variants - 各尺寸版本
router.get('/api/images/:id/variants', (ctx) => {
  const v = service.variants(Number(ctx.params.id));
  if (v === null) {
    ctx.status = 404;
    ctx.body = { message: '图片不存在' };
    return;
  }
  ctx.body = v;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[图片处理系统] running at http://localhost:' + PORT));
