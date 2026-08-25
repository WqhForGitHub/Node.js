import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('config') config() {
    return this.app.config();
  }
  @Get('reload') reload() {
    return this.app.reload();
  }
}
