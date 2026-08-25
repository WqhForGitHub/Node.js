import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('orders')
export class AppController {
  constructor(private app: AppService) {}
  @Post() create(@Body() body: any) {
    return this.app.create(body);
  }
}
