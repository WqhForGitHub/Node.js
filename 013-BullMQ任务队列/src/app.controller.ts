import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('email')
export class AppController {
  constructor(private readonly app: AppService) {}
  @Post('send') send(@Body() body: { to: string; subject: string }) {
    return this.app.enqueue(body);
  }
}
