import { Module } from '@nestjs/common';
import { UserController } from './presentation/user.controller';
import { UserService } from './application/user.service';
import { UserRepository } from './infrastructure/user.repository';
@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
})
export class AppModule {}
