import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from Nest.js! (基础入门服务)';
  }
}
