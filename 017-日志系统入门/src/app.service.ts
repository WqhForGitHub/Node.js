import { Injectable, Logger } from '@nestjs/common';
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  result() {
    this.logger.log('Service called');
    return { ok: true, time: new Date().toISOString() };
  }
}
