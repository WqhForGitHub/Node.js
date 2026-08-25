import { Body, Controller, Get, Post } from '@nestjs/common';
import { CoreUserService } from '../core/user.service';
@Controller('users')
export class HttpUserController {
  constructor(private svc: CoreUserService) {}
  @Get() findAll() {
    return this.svc.list();
  }
  @Post() create(@Body() body: { name: string }) {
    return this.svc.create(body.name);
  }
}
