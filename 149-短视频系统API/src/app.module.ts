import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { VideoModule } from './video/video.module';
import { CommentModule } from './comment/comment.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, VideoModule, CommentModule, StatsModule] })
export class AppModule {}
