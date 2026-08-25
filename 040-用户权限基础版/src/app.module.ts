import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { RolesGuard } from './auth/roles.guard';
@Module({
  imports: [AuthModule, AdminModule],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
