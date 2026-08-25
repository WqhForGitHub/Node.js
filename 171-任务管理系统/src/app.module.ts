import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TaskModule } from './task/task.module';
import { ProjectModule } from './project/project.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, TaskModule, ProjectModule, StatsModule] })
export class AppModule {}
