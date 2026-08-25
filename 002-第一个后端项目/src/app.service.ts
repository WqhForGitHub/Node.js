import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from Nest.js! (第一个后端项目)';
  }
}
