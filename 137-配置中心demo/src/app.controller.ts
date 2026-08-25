import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
@Controller()
export class AppController {
  constructor(
    private readonly config: ConfigService,
    private readonly app: AppService
  ) {}
  @Get() info() {
    return {
      env: this.config.get('NODE_ENV', 'development'),
      port: this.config.get('PORT', 3000),
      db: this.config.get('DATABASE_URL', 'memory'),
      time: this.app.now(),
    };
  }
}
