import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';
@Controller('users')
export class UserController {
  constructor(private svc: UserService) {}
  @Get() findAll() {
    return this.svc.findAll();
  }
}
