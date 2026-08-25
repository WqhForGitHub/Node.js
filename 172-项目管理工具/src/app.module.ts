import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ProjectModule, TaskModule, StatsModule] })
export class AppModule {}
