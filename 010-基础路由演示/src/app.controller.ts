import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AppService } from './app.service';
@Controller('demo')
export class AppController {
  constructor(private readonly svc: AppService) {}
  @Get('hello') hello() {
    return this.svc.hello();
  }
  @Get('users') users(@Query('page') page?: number) {
    return this.svc.listUsers(page);
  }
  @Post('users') create(@Body() body: any) {
    return this.svc.create(body);
  }
  @Put('users/:id') replace(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.replace(id, body);
  }
  @Patch('users/:id') patch(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.patch(id, body);
  }
  @Delete('users/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
