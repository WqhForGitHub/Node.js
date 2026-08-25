import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from Nest.js! (快速启动模板)';
  }
}
