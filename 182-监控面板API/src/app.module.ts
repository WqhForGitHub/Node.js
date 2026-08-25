import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WidgetModule } from './widget/widget.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, DashboardModule, WidgetModule, StatsModule] })
export class AppModule {}
