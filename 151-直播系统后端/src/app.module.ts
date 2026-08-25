import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { LiveRoomModule } from './liveRoom/liveRoom.module';
import { ViewerModule } from './viewer/viewer.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, LiveRoomModule, ViewerModule, StatsModule] })
export class AppModule {}
