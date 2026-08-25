import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderListener } from './order.listener';
@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, OrderListener],
})
export class AppModule {}
