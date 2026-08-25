import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ItemModule } from './item/item.module';
import { PurchaseModule } from './purchase/purchase.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, ItemModule, PurchaseModule, StatsModule] })
export class AppModule {}
