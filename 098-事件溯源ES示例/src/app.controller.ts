import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AccountService } from './account.service';
import { EventStore } from './event.store';
@Controller('accounts')
export class AppController {
  constructor(
    private svc: AccountService,
    private store: EventStore
  ) {}
  @Post(':id/deposit') deposit(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.svc.deposit(id, body.amount);
  }
  @Post(':id/withdraw') withdraw(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.svc.withdraw(id, body.amount);
  }
  @Get(':id') balance(@Param('id') id: string) {
    return this.svc.replay(id);
  }
  @Get('events/all') events() {
    return this.store.loadAll();
  }
}
