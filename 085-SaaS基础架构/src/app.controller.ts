import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('items')
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get() findAll(@Req() req: any) {
    return this.app.findAll(req.tenantId);
  }
  @Post() create(@Req() req: any, @Body() body: any) {
    return this.app.create(req.tenantId, body);
  }
}
