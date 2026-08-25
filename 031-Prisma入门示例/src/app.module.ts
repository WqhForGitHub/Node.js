import { Module } from '@nestjs/common';
import { ItemModule } from './item/item.module';
@Module({ imports: [ItemModule] })
export class AppModule {}
