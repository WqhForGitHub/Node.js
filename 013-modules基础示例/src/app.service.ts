import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  info() {
    return { name: 'Nest Service Demo', time: new Date().toISOString() };
  }
}
