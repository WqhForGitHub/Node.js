import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CourseModule } from './course/course.module';
import { PurchaseModule } from './purchase/purchase.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, CourseModule, PurchaseModule, StatsModule] })
export class AppModule {}
