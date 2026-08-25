import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsInterceptor } from './metrics.interceptor';
@Module({
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
