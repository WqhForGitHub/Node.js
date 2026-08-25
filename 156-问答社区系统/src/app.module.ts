import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { QuestionModule } from './question/question.module';
import { AnswerModule } from './answer/answer.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, QuestionModule, AnswerModule, StatsModule] })
export class AppModule {}
