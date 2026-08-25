import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TweetModule } from './tweet/tweet.module';
import { FollowModule } from './follow/follow.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, TweetModule, FollowModule, StatsModule] })
export class AppModule {}
