import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TripModule } from './trip/trip.module';
import { DriverModule } from './driver/driver.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, TripModule, DriverModule, StatsModule] })
export class AppModule {}
