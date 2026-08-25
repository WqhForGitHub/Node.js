import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AccountService } from './account.service';
import { EventStore } from './event.store';
@Module({
  controllers: [AppController],
  providers: [AccountService, EventStore],
})
export class AppModule {}
