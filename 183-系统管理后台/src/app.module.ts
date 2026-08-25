import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PermissionModule } from './permission/permission.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, UserModule, PermissionModule, StatsModule] })
export class AppModule {}
