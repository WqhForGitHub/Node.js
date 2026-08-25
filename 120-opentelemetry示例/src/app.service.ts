import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  work() {
    return { trace: 'ok', time: Date.now() };
  }
}
