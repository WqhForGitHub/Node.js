import { Module } from '@nestjs/common';
import { SeckillController } from './seckill.controller';
import { SeckillService } from './seckill.service';
@Module({ controllers: [SeckillController], providers: [SeckillService] })
export class SeckillModule {}
