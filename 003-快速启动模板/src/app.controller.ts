import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: '快速启动模板', no: 3 };
  }
  @Get('info') getInfo() {
    return { name: '快速启动模板', framework: 'Nest.js', version: '0.0.1' };
  }
}
