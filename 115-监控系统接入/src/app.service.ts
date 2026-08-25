import { Injectable } from '@nestjs/common';
@Injectable()
export class AppService {
  stats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
      timestamp: Date.now(),
    };
  }
}
