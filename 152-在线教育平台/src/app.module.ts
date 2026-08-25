import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CourseModule } from './course/course.module';
import { LessonModule } from './lesson/lesson.module';
import { StatsModule } from './stats/stats.module';
@Module({ imports: [AuthModule, CourseModule, LessonModule, StatsModule] })
export class AppModule {}
