import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/user.repository';
import { User } from '../domain/user.entity';
@Injectable()
export class UserService {
  constructor(private repo: UserRepository) {}
  findAll() {
    return this.repo.findAll();
  }
  create(name: string, email: string) {
    return this.repo.save(new User(Date.now(), name, email));
  }
}
