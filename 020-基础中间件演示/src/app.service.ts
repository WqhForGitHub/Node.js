import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  ping() {
    return { pong: true, time: Date.now() };
  }
}
