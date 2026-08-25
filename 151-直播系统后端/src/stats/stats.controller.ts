import { Controller, Get } from '@nestjs/common';
@Controller('stats')
export class StatsController {
  @Get() stats() {
    return { total: 0, active: 0, generatedAt: new Date().toISOString() };
  }
}
