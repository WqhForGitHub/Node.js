import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ToIntPipe } from './to-int.pipe';
@Module({ controllers: [AppController], providers: [AppService, ToIntPipe] })
export class AppModule {}
