import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { DealModule } from './deal/deal.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, CustomerModule, DealModule, StatsModule] })
export class AppModule {}
