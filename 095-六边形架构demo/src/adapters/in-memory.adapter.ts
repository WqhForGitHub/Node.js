import { Injectable } from '@nestjs/common';
import { UserPort } from '../core/ports';
@Injectable()
export class InMemoryUserAdapter implements UserPort {
  private users: any[] = [{ id: 1, name: 'Alice' }];
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
