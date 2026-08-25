import { Module } from '@nestjs/common';
import { SeckillModule } from './seckill.module';
@Module({ imports: [SeckillModule] })
export class AppModule {}
