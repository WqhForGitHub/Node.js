import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { IssueModule } from './issue/issue.module';
import { SprintModule } from './sprint/sprint.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, IssueModule, SprintModule, StatsModule] })
export class AppModule {}
