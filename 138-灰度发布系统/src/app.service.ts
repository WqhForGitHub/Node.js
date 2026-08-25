import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  data() {
    return { items: [1, 2, 3] };
  }
}
