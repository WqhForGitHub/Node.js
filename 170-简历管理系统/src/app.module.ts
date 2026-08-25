import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ResumeModule } from './resume/resume.module';
import { ExperienceModule } from './experience/experience.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ResumeModule, ExperienceModule, StatsModule] })
export class AppModule {}
