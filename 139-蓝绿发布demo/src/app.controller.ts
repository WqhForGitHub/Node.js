import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    @Inject('ACTIVE_COLOR') private color: string
  ) {}
  @Get('status') status() {
    return { color: this.color, version: this.app.version() };
  }
}
