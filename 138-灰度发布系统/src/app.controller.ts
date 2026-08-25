import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { FeatureFlagService } from './feature-flag.service';
@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly flags: FeatureFlagService
  ) {}
  @Get('home') home(@Query('userId') userId: number) {
    const uid = Number(userId) || 1;
    return {
      ui: this.flags.isEnabled('new-ui', uid) ? 'v2' : 'v1',
      data: this.app.data(),
    };
  }
}
