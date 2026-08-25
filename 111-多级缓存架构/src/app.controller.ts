import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('data/:key') data(@Param('key') key: string) {
    return this.app.get(key);
  }
}
