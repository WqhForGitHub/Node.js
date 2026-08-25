import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ServiceModule } from './service/service.module';
import { ChannelModule } from './channel/channel.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ServiceModule, ChannelModule, StatsModule] })
export class AppModule {}
