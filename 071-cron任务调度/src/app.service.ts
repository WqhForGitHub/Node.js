import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private count = 0;
  @Cron(CronExpression.EVERY_30_SECONDS) handleCron() {
    this.count++;
    this.logger.log('Cron tick #' + this.count);
  }
  @Cron('*/10 * * * * *') everyTenSeconds() {
    this.logger.log('10s interval fired');
  }
  stats() {
    return { count: this.count };
  }
}
