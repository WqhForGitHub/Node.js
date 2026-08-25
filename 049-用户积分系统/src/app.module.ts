import { Module } from '@nestjs/common';
import { PointModule } from './point.module';
@Module({ imports: [PointModule] })
export class AppModule {}
