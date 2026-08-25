import { Module } from '@nestjs/common';
import { StatModule } from './stat.module';
@Module({ imports: [StatModule] })
export class AppModule {}
