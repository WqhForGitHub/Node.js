import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { VideoModule } from './video/video.module';
import { PlaylistModule } from './playlist/playlist.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, VideoModule, PlaylistModule, StatsModule] })
export class AppModule {}
