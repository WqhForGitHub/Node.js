import { Module } from '@nestjs/common';
import { ChartModule } from './chart.module';
@Module({ imports: [ChartModule] })
export class AppModule {}
