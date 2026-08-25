import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('aggregate')
export class AppController {
  constructor(private app: AppService) {}
  @Get() async aggregate() {
    return await this.app.aggregate();
  }
}
