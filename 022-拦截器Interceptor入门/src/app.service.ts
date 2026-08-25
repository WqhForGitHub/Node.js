import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  data() {
    return { value: Math.random() };
  }
}
