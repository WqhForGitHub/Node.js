import { Module } from '@nestjs/common';
import { ReportModule } from './report.module';
@Module({ imports: [ReportModule] })
export class AppModule {}
