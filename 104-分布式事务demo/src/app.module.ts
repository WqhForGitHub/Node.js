import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OutboxService } from './outbox.service';
@Module({ controllers: [AppController], providers: [OutboxService] })
export class AppModule {}
