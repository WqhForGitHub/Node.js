import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
@Module({
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: TenantGuard }],
})
export class AppModule {}
