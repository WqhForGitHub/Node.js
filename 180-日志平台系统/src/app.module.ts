import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { LogEntryModule } from './logEntry/logEntry.module';
import { SourceModule } from './source/source.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, LogEntryModule, SourceModule, StatsModule] })
export class AppModule {}
