import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { TransactionModule } from './transaction/transaction.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, AccountModule, TransactionModule, StatsModule],
})
export class AppModule {}
