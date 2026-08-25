import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { QuestionModule } from './question/question.module';
import { PaperModule } from './paper/paper.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, QuestionModule, PaperModule, StatsModule] })
export class AppModule {}
