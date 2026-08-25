import { Module } from '@nestjs/common';
import { CartModule } from './cart.module';
@Module({ imports: [CartModule] })
export class AppModule {}
