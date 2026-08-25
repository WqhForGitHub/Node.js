import { Body, Controller, Get, Post } from '@nestjs/common';
import { OutboxService } from './outbox.service';
@Controller('outbox')
export class AppController {
  constructor(private outbox: OutboxService) {}
  @Post() publish(@Body() body: any) {
    return this.outbox.publish(body);
  }
  @Get('pending') pending() {
    return this.outbox.pending();
  }
}
