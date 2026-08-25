import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TopicModule } from './topic/topic.module';
import { ReplyModule } from './reply/reply.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, TopicModule, ReplyModule, StatsModule] })
export class AppModule {}
