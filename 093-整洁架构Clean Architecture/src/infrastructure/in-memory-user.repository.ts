import { Injectable } from '@nestjs/common';
import { UserRepository, User } from '../domain/user.model';
@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [{ id: 1, name: 'Alice' }];
  private id = 1;
  findAll() {
    return this.users;
  }
  create(name: string) {
    const u = { id: ++this.id, name };
    this.users.push(u);
    return u;
  }
}
