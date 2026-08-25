import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FileModule } from './file/file.module';
import { SyncTaskModule } from './syncTask/syncTask.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, FileModule, SyncTaskModule, StatsModule] })
export class AppModule {}
