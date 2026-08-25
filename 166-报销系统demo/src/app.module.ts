import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ExpenseModule } from './expense/expense.module';
import { CategoryModule } from './category/category.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ExpenseModule, CategoryModule, StatsModule] })
export class AppModule {}
