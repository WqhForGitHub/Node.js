import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ExtensionModule } from './extension/extension.module';
import { UserModule } from './user/user.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ExtensionModule, UserModule, StatsModule] })
export class AppModule {}
