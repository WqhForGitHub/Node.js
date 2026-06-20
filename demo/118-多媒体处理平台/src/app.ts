import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

/**
 * 多媒体处理平台
 * 媒体元数据管理、转码任务，模拟转码进度推进
 */
const app = new Koa();
const router = new Router();
app.use(bodyParser());

interface Media {
  id: number;
  type: 'video' | 'audio';
  duration: number;
  format: string;
  outputs: { format: string; taskId: number }[];
  createdAt: string;
}
interface TranscodeTask {
  id: number;
  mediaId: number;
  sourceFormat: string;
  targetFormat: string;
  status: 'pending' | 'processing' | 'done';
  progress: number;
  createdAt: string;
}

// 仓储层
class MediaRepository {
  private medias: Media[] = [];
  private tasks: TranscodeTask[] = [];
  private mSeq = 0;
  private tSeq = 0;
  createMedia(data: any): Media {
    const m: Media = {
      id: ++this.mSeq,
      type: data.type,
      duration: data.duration,
      format: data.format,
      outputs: [],
      createdAt: new Date().toISOString(),
    };
    this.medias.push(m);
    return m;
  }
  findMedia(id: number) {
    return this.medias.find((m) => m.id === id);
  }
  createTask(media: Media, targetFormat: string): TranscodeTask {
    const t: TranscodeTask = {
      id: ++this.tSeq,
      mediaId: media.id,
      sourceFormat: media.format,
      targetFormat,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(t);
    // 模拟转码进度推进，每 800ms +20
    const timer = setInterval(() => {
      t.progress += 20;
      t.status = t.progress >= 100 ? 'done' : 'processing';
      if (t.status === 'done') {
        const m = this.findMedia(media.id);
        if (m) m.outputs.push({ format: targetFormat, taskId: t.id });
        clearInterval(timer);
      }
    }, 800);
    return t;
  }
  findTask(id: number) {
    return this.tasks.find((t) => t.id === id);
  }
}

// 服务层
class MediaService {
  constructor(private repo: MediaRepository) {}
  create(data: any) {
    if (!data.type || !data.format || data.duration === undefined) {
      throw new Error('参数缺失: type/format/duration');
    }
    if (data.type !== 'video' && data.type !== 'audio') throw new Error('type 必须为 video/audio');
    return this.repo.createMedia(data);
  }
  get(id: number) {
    return this.repo.findMedia(id);
  }
  transcode(id: number, targetFormat: string) {
    const m = this.repo.findMedia(id);
    if (!m) return null;
    if (!targetFormat) throw new Error('targetFormat 必填');
    return this.repo.createTask(m, targetFormat);
  }
  task(taskId: number) {
    return this.repo.findTask(taskId);
  }
  outputs(id: number) {
    const m = this.repo.findMedia(id);
    return m ? m.outputs : null;
  }
}

const repo = new MediaRepository();
const service = new MediaService(repo);

// POST /api/media - 上传媒体元数据
router.post('/api/media', (ctx) => {
  try {
    ctx.status = 201;
    ctx.body = service.create(ctx.request.body || {});
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// POST /api/media/:id/transcode - 创建转码任务
router.post('/api/media/:id/transcode', (ctx) => {
  try {
    const t = service.transcode(Number(ctx.params.id), (ctx.request.body as any).targetFormat);
    if (!t) {
      ctx.status = 404;
      ctx.body = { message: '媒体不存在' };
      return;
    }
    ctx.status = 201;
    ctx.body = { taskId: t.id, status: t.status, targetFormat: t.targetFormat };
  } catch (e: any) {
    ctx.status = 400;
    ctx.body = { message: e.message };
  }
});
// GET /api/transcode/:taskId - 转码任务状态 + 进度
router.get('/api/transcode/:taskId', (ctx) => {
  const t = service.task(Number(ctx.params.taskId));
  if (!t) {
    ctx.status = 404;
    ctx.body = { message: '任务不存在' };
    return;
  }
  ctx.body = t;
});
// GET /api/media/:id/outputs - 转码输出列表
router.get('/api/media/:id/outputs', (ctx) => {
  const o = service.outputs(Number(ctx.params.id));
  if (o === null) {
    ctx.status = 404;
    ctx.body = { message: '媒体不存在' };
    return;
  }
  ctx.body = o;
});

app.use(router.routes()).use(router.allowedMethods());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[多媒体处理平台] running at http://localhost:' + PORT));
