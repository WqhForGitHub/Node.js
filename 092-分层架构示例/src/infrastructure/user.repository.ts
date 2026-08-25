import { Injectable } from '@nestjs/common';
import { User } from '../domain/user.entity';
@Injectable()
export class UserRepository {
  private users: User[] = [new User(1, 'Alice', 'a@b.com')];
  findAll() {
    return this.users;
  }
  save(user: User) {
    this.users.push(user);
    return user;
  }
}
