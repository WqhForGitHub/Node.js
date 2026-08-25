import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
@Controller('calc')
export class AppController {
  constructor(private app: AppService) {}
  @Get('add/:a/:b') add(@Param('a') a: string, @Param('b') b: string) {
    return { result: this.app.add(Number(a), Number(b)) };
  }
}
