import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { DeliveryModule } from './delivery/delivery.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, RestaurantModule, DeliveryModule, StatsModule],
})
export class AppModule {}
