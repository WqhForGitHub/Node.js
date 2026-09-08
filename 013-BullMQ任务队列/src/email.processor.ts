import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  async process(job: Job) {
    this.logger.log('Processing email job ' + job.id + ': ' + JSON.stringify(job.data));
    return { sent: true, to: job.data.to };
  }
}
