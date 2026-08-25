import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('heavy/:id') heavy(@Param('id') id: string) {
    return this.app.compute(id);
  }
}
