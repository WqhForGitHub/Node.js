import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service';
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}
  @Get() findAll() {
    return this.users.findAll();
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }
}
