import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: '极简API服务', no: 4 };
  }
  @Get('info') getInfo() {
    return { name: '极简API服务', framework: 'Nest.js', version: '0.0.1' };
  }
}
