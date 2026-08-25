import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  add(a: number, b: number) {
    return a + b;
  }
}
