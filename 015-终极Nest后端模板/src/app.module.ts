import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AuditLogModule } from './auditLog/auditLog.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, UserModule, AuditLogModule, StatsModule] })
export class AppModule {}
