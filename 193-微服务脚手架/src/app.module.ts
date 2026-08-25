import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from './config/config.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, UserModule, ConfigModule, StatsModule] })
export class AppModule {}
