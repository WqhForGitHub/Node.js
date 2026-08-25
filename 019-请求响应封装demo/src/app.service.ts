import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  data() {
    return { list: [1, 2, 3], total: 3 };
  }
}
