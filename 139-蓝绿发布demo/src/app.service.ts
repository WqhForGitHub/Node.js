import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  version() {
    return '1.0.0';
  }
}
