import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ApiModule } from './api/api.module';
import { EnvironmentModule } from './environment/environment.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ApiModule, EnvironmentModule, StatsModule] })
export class AppModule {}
