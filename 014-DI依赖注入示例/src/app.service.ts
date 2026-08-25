import { Inject, Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  constructor(@Inject('APP_NAME') private readonly appName: string) {}
  info() {
    return { app: this.appName, time: new Date().toISOString() };
  }
}
