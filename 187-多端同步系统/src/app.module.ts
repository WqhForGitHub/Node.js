import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DeviceModule } from './device/device.module';
import { SyncItemModule } from './syncItem/syncItem.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, DeviceModule, SyncItemModule, StatsModule] })
export class AppModule {}
