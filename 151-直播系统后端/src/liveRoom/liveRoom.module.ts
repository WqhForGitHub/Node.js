import { Module } from '@nestjs/common';
import { LiveRoomController } from './liveRoom.controller';
import { LiveRoomService } from './liveRoom.service';
@Module({ controllers: [LiveRoomController], providers: [LiveRoomService] })
export class LiveRoomModule {}
