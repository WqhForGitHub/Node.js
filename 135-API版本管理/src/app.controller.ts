import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';
@Controller({ path: 'items', version: ['1', '2'] })
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() @Version('1') v1() {
    return this.app.v1();
  }
  @Get() @Version('2') v2() {
    return this.app.v2();
  }
  @Get('info') @Version([VERSION_NEUTRAL]) info() {
    return { name: 'items-api' };
  }
}
