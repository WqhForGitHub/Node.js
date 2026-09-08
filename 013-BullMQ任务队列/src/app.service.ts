import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
@Injectable()
export class AppService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}
  async enqueue(data: { to: string; subject: string }) {
    const job = await this.emailQueue.add('send', data);
    return { jobId: job.id, status: 'queued' };
  }
}
