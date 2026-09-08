import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateUserDto } from './dto/create-user.dto';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Post('users') create(@Body() dto: CreateUserDto) {
    return this.app.create(dto);
  }
  @Get('users') findAll() {
    return this.app.findAll();
  }
}
