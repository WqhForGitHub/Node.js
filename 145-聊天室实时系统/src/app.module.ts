import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RoomModule } from './room/room.module';
import { MessageModule } from './message/message.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, RoomModule, MessageModule, StatsModule] })
export class AppModule {}
