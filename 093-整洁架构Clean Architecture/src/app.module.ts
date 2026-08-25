import { Module } from '@nestjs/common';
import { UserController } from './adapters/user.controller';
import { CreateUserUseCase } from './use-cases/create-user.usecase';
import { ListUsersUseCase } from './use-cases/list-users.usecase';
import { InMemoryUserRepository } from './infrastructure/in-memory-user.repository';
import { UserRepository } from './domain/user.model';
@Module({
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    ListUsersUseCase,
    InMemoryUserRepository,
    { provide: UserRepository, useExisting: InMemoryUserRepository },
  ],
})
export class AppModule {}
