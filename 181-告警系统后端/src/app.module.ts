import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AlertModule } from './alert/alert.module';
import { RuleModule } from './rule/rule.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, AlertModule, RuleModule, StatsModule] })
export class AppModule {}
