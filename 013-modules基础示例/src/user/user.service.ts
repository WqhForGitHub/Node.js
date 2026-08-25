import { Injectable } from '@nestjs/common';
@Injectable()
export class UserService {
  private users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  findAll() {
    return this.users;
  }
  findOne(id: number) {
    return this.users.find((u) => u.id === id);
  }
}
