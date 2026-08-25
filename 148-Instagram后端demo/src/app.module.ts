import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PhotoModule } from './photo/photo.module';
import { CommentModule } from './comment/comment.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PhotoModule, CommentModule, StatsModule] })
export class AppModule {}
