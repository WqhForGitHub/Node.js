import { Injectable } from '@nestjs/common';
import { UserRepository, User } from '../domain/user.model';
@Injectable()
export class CreateUserUseCase {
  constructor(private repo: UserRepository) {}
  execute(name: string): User {
    return this.repo.create(name);
  }
}
