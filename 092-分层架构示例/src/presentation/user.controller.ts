import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from '../application/user.service';
@Controller('users')
export class UserController {
  constructor(private svc: UserService) {}
  @Get() findAll() {
    return this.svc.findAll();
  }
  @Post() create(@Body() body: { name: string; email: string }) {
    return this.svc.create(body.name, body.email);
  }
}
