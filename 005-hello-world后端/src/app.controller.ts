import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: 'hello-world后端', no: 5 };
  }
  @Get('info') getInfo() {
    return { name: 'hello-world后端', framework: 'Nest.js', version: '0.0.1' };
  }
}
