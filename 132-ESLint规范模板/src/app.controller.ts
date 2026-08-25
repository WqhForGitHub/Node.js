import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() getHello() {
    return { message: this.app.getHello(), demo: 'ESLint规范模板', no: 132 };
  }
  @Get('info') getInfo() {
    return { name: 'ESLint规范模板', framework: 'Nest.js', version: '0.0.1' };
  }
}
