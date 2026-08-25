import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  square(n: number) {
    return { input: n, output: n * n };
  }
}
