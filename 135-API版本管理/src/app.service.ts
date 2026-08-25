import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  v1() {
    return { version: 1, data: [1, 2] };
  }
  v2() {
    return { version: 2, data: [1, 2, 3] };
  }
}
