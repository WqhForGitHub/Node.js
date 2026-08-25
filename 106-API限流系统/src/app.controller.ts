import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('api')
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('ping') ping() {
    return this.app.ping();
  }
}
