import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  now() {
    return new Date().toISOString();
  }
}
