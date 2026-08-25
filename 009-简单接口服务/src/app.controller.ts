import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: '简单接口服务', no: 9 };
  }
  @Get('info') getInfo() {
    return { name: '简单接口服务', framework: 'Nest.js', version: '0.0.1' };
  }
}
