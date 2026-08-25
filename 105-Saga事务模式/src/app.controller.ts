import { Controller, Get, Post } from '@nestjs/common';
import { SagaOrchestrator } from './saga.orchestrator';
@Controller('saga')
export class AppController {
  constructor(private saga: SagaOrchestrator) {}
  @Post('order') async order() {
    return await this.saga.run([
      {
        name: 'reserve-stock',
        run: () => undefined,
        compensate: () => undefined,
      },
      {
        name: 'charge-payment',
        run: () => undefined,
        compensate: () => undefined,
      },
      { name: 'ship', run: () => undefined, compensate: () => undefined },
    ]);
  }
  @Get('log') log() {
    return this.saga.getLog();
  }
}
