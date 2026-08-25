import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ExamModule } from './exam/exam.module';
import { SubmissionModule } from './submission/submission.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ExamModule, SubmissionModule, StatsModule] })
export class AppModule {}
