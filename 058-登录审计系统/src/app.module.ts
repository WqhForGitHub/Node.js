import { Module } from '@nestjs/common';
import { AuditLogModule } from './auditLog.module';
@Module({ imports: [AuditLogModule] })
export class AppModule {}
