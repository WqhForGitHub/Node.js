import { Module } from '@nestjs/common';
import { GoodsModule } from './goods/goods.module';
@Module({ imports: [GoodsModule] })
export class AppModule {}
