import { Controller, Get, Param, UsePipes } from '@nestjs/common';
import { AppService } from './app.service';
import { ToIntPipe } from './to-int.pipe';
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get('square/:n')
  @UsePipes(ToIntPipe)
  square(@Param('n') n: any) {
    return this.app.square(n);
  }
}
