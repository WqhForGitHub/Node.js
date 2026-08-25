import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly app: AppService) {}
  @Get() run() {
    this.logger.log('Handling request');
    this.logger.warn('Sample warn');
    this.logger.error('Sample error');
    return this.app.result();
  }
}
