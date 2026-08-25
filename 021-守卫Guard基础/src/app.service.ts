import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  data() {
    return { secret: 'you are authorized' };
  }
}
