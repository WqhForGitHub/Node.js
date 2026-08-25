import { Module } from '@nestjs/common';
import { BehaviorModule } from './behavior.module';
@Module({ imports: [BehaviorModule] })
export class AppModule {}
