import { Injectable } from '@nestjs/common';
import { UserRepository, User } from '../domain/user.model';
@Injectable()
export class ListUsersUseCase {
  constructor(private repo: UserRepository) {}
  execute(): User[] {
    return this.repo.findAll();
  }
}
