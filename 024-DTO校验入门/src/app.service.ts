import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
@Injectable()
export class AppService {
  private users: any[] = [];
  private id = 0;
  create(dto: CreateUserDto) {
    const u = { id: ++this.id, ...dto };
    this.users.push(u);
    return u;
  }
  findAll() {
    return this.users;
  }
}
