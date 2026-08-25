import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateUserUseCase } from '../use-cases/create-user.usecase';
import { ListUsersUseCase } from '../use-cases/list-users.usecase';
@Controller('users')
export class UserController {
  constructor(
    private createUC: CreateUserUseCase,
    private listUC: ListUsersUseCase
  ) {}
  @Get() findAll() {
    return this.listUC.execute();
  }
  @Post() create(@Body() body: { name: string }) {
    return this.createUC.execute(body.name);
  }
}
