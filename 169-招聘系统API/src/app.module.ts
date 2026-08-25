import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CandidateModule } from './candidate/candidate.module';
import { PositionModule } from './position/position.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, CandidateModule, PositionModule, StatsModule] })
export class AppModule {}
