import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, PlanModule, SubscriptionModule, StatsModule] })
export class AppModule {}
