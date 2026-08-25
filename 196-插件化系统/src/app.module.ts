import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PluginModule } from './plugin/plugin.module';
import { ConfigModule } from './config/config.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PluginModule, ConfigModule, StatsModule] })
export class AppModule {}
