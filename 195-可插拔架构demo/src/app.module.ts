import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PluginModule } from './plugin/plugin.module';
import { UserModule } from './user/user.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PluginModule, UserModule, StatsModule] })
export class AppModule {}
