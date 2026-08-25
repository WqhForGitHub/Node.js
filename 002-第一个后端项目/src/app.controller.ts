import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: '第一个后端项目', no: 2 };
  }
  @Get('info') getInfo() {
    return { name: '第一个后端项目', framework: 'Nest.js', version: '0.0.1' };
  }
}
