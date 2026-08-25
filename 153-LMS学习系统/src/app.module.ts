import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CourseModule } from './course/course.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, CourseModule, EnrollmentModule, StatsModule] })
export class AppModule {}
