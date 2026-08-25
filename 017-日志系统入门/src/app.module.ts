import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
@Module({ controllers: [AppController], providers: [AppService, Logger] })
export class AppModule {}
