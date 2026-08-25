import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatasetModule } from './dataset/dataset.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, DatasetModule, PipelineModule, StatsModule] })
export class AppModule {}
