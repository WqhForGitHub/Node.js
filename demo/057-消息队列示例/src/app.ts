import express, { Request, Response } from 'express';

/**
 * 消息队列示例
 * Express + TypeScript 队列示例（内存队列模拟）
 */
interface Job {
  id: number;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

class JobQueue {
  private jobs: Job[] = [];
  private nextId = 1;
  private processing = false;

  enqueue(type: string, data: any): Job {
    const job: Job = {
      id: this.nextId++,
      type,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    this.process();
    return job;
  }

  getJob(id: number): Job | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  list(): Job[] {
    return this.jobs;
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (true) {
      const job = this.jobs.find((j) => j.status === 'pending');
      if (!job) break;
      job.status = 'processing';
      job.updatedAt = new Date().toISOString();
      try {
        // 模拟异步任务
        await new Promise((resolve) => setTimeout(resolve, 100));
        job.result = { processed: true, ...job.data };
        job.status = 'completed';
      } catch (e) {
        job.error = (e as Error).message;
        job.status = 'failed';
      }
      job.updatedAt = new Date().toISOString();
    }
    this.processing = false;
  }
}

const app = express();
app.use(express.json());

const queue = new JobQueue();

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: '消息队列示例' });
});

// 入队
app.post('/api/jobs', (req: Request, res: Response) => {
  const { type, data } = req.body || {};
  if (!type) {
    res.status(400).json({ message: '缺少 type' });
    return;
  }
  const job = queue.enqueue(type, data || {});
  res.status(201).json(job);
});

// 查询所有任务
app.get('/api/jobs', (_req: Request, res: Response) => {
  res.json(queue.list());
});

// 查询单个任务
app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const job = queue.getJob(Number(req.params.id));
  if (!job) {
    res.status(404).json({ message: '任务不存在' });
    return;
  }
  res.json(job);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[消息队列示例] running at http://localhost:' + PORT);
});
