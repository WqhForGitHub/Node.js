import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ModuleModule } from './module/module.module';
import { UserModule } from './user/user.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ModuleModule, UserModule, StatsModule] })
export class AppModule {}
