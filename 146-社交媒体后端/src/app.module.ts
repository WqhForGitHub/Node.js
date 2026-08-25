import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './post/post.module';
import { FollowModule } from './follow/follow.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PostModule, FollowModule, StatsModule] })
export class AppModule {}
