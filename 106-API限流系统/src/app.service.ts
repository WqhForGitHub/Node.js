import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  ping() {
    return { ok: true, time: Date.now() };
  }
}
