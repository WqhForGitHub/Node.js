import { Injectable } from '@nestjs/common';
import { UserPort } from './ports';
@Injectable()
export class CoreUserService {
  constructor(private port: UserPort) {}
  list() {
    return this.port.findAll();
  }
  create(name: string) {
    return this.port.create(name);
  }
}
