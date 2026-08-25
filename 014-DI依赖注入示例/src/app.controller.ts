import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from './user/user.service';
@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly users: UserService
  ) {}
  @Get() info() {
    return { app: this.app.info(), users: this.users.findAll() };
  }
}
