import { BadRequestException, Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('ok') ok() {
    return { message: this.app.ok() };
  }
  @Get('fail') fail() {
    throw new BadRequestException('Something went wrong');
  }
  @Get('items/:id') item(@Param('id', ParseIntPipe) id: number) {
    return this.app.item(id);
  }
}
