import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { SessionModule } from './session/session.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, UserModule, SessionModule, StatsModule] })
export class AppModule {}
